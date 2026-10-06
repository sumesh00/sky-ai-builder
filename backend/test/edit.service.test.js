const assert = require('node:assert/strict')
const { test } = require('node:test')
const { validateEditPath } = require('../src/editing/editValidator')
const {
  ProjectProcessRegistry,
} = require('../src/processes/projectProcessRegistry')
const { EditService } = require('../src/services/edit.service')

function createProjectService(designSpecification = null) {
  const touches = []

  return {
    touches,
    async getProject(projectId) {
      return {
        id: projectId,
        name: 'Travel Site',
        originatingPlan: designSpecification
          ? { designReference: { designSpecification } }
          : undefined,
        type: 'frontend',
      }
    },
    async touchProject(projectId) {
      touches.push(projectId)
      return { id: projectId }
    },
  }
}

function createWorkspace() {
  const files = new Map([
    [
      'frontend/src/App.jsx',
      'export default function App() { return <h1>Old title</h1> }\n',
    ],
    [
      'frontend/src/Unrelated.jsx',
      'const privateUnrelatedMarker = "DO_NOT_SEND_THIS_FILE"\n',
    ],
  ])
  const writes = []

  return {
    files,
    writes,
    async listFiles() {
      return {
        entries: [
          { path: 'frontend', size: null, type: 'directory' },
          { path: 'frontend/src', size: null, type: 'directory' },
          ...[...files].map(([path, content]) => ({
            path,
            size: Buffer.byteLength(content),
            type: 'file',
          })),
        ],
      }
    },
    async readFile(path) {
      const content = files.get(path)
      return { content, path, size: Buffer.byteLength(content) }
    },
    async searchCode() {
      return { results: [], truncated: false }
    },
    async writeFile(path, content, options = {}) {
      if (files.has(path) && !options.overwrite) {
        throw new Error('Expected overwrite permission')
      }

      files.set(path, content)
      writes.push({ content, options, path })
      return { created: !options.overwrite, path, size: Buffer.byteLength(content) }
    },
  }
}

function createProvider(results, requests) {
  return {
    async generateStructured(request) {
      requests.push(request)
      const value = results.shift()

      return {
        model: 'test-model',
        provider: 'test-provider',
        responseId: `response-${requests.length}`,
        value,
      }
    },
  }
}

test('reads targeted files and applies validated replace and create operations', async () => {
  const projectService = createProjectService()
  const requests = []
  const workspace = createWorkspace()
  const provider = createProvider(
    [
      {
        paths: ['frontend/src/App.jsx'],
        rationale: 'The heading is rendered here',
        searchTerms: [],
      },
      {
        operations: [
          {
            content: '',
            path: 'frontend/src/App.jsx',
            replaceAll: false,
            replacement: 'New title',
            search: 'Old title',
            type: 'replace',
          },
          {
            content: ':root { color-scheme: dark; }\n',
            path: 'frontend/src/theme.css',
            replaceAll: false,
            replacement: '',
            search: '',
            type: 'create',
          },
        ],
        summary: 'Updated the title and added the theme file.',
      },
    ],
    requests,
  )
  const service = new EditService({
    processRegistry: new ProjectProcessRegistry(),
    projectService,
    providerFactory: () => provider,
    workspaceFactory: async () => workspace,
  })

  const result = await service.editProject('travel-site', 'Update the title')

  assert.equal(result.summary, 'Updated the title and added the theme file.')
  assert.deepEqual(
    result.changes.map(({ action, path }) => ({ action, path })),
    [
      { action: 'updated', path: 'frontend/src/App.jsx' },
      { action: 'created', path: 'frontend/src/theme.css' },
    ],
  )
  assert.match(workspace.files.get('frontend/src/App.jsx'), /New title/)
  assert.equal(
    workspace.files.get('frontend/src/theme.css'),
    ':root { color-scheme: dark; }\n',
  )
  assert.equal(projectService.touches.length, 1)
  assert.equal(requests[1].input.includes('Old title'), true)
  assert.equal(requests[1].input.includes('DO_NOT_SEND_THIS_FILE'), false)
})

test('uses a stored Figma specification to update source code without creating design documentation', async () => {
  const designSpecification = {
    colors: ['#0f1f2e'],
    hierarchy: { name: 'Landing page', type: 'FRAME' },
    typography: [{ fontFamily: 'Inter', fontSize: 72 }],
    version: 1,
  }
  const requests = []
  const workspace = createWorkspace()
  const provider = createProvider(
    [
      {
        paths: ['frontend/src/App.jsx'],
        rationale: 'The Figma hierarchy maps to the page component.',
        searchTerms: [],
      },
      {
        operations: [
          {
            content: '',
            path: 'frontend/src/App.jsx',
            replaceAll: false,
            replacement: 'Figma aligned title',
            search: 'Old title',
            type: 'replace',
          },
        ],
        summary: 'Updated the source component to match the Figma frame.',
      },
    ],
    requests,
  )
  const service = new EditService({
    processRegistry: new ProjectProcessRegistry(),
    projectService: createProjectService(designSpecification),
    providerFactory: () => provider,
    workspaceFactory: async () => workspace,
  })

  const result = await service.editProject('travel-site', 'Match the supplied Figma frame')

  assert.deepEqual(result.changes.map((change) => change.path), ['frontend/src/App.jsx'])
  assert.match(workspace.files.get('frontend/src/App.jsx'), /Figma aligned title/)
  assert.equal(workspace.files.has('DESIGN_ALIGNMENT.md'), false)
  assert.equal(requests[0].instructions.includes('Never create DESIGN_ALIGNMENT.md'), true)
  assert.deepEqual(JSON.parse(requests[1].input).designSpecification, designSpecification)
})

test('rejects Figma edit operations that attempt to create design documentation', async () => {
  const workspace = createWorkspace()
  const provider = createProvider(
    [
      {
        paths: ['frontend/src/App.jsx'],
        rationale: 'Inspect the page source.',
        searchTerms: [],
      },
      {
        operations: [
          {
            content: '# Alignment notes',
            path: 'DESIGN_ALIGNMENT.md',
            replaceAll: false,
            replacement: '',
            search: '',
            type: 'create',
          },
        ],
        summary: 'Created design notes.',
      },
    ],
    [],
  )
  const service = new EditService({
    processRegistry: new ProjectProcessRegistry(),
    projectService: createProjectService({ hierarchy: {}, version: 1 }),
    providerFactory: () => provider,
    workspaceFactory: async () => workspace,
  })

  await assert.rejects(
    service.editProject('travel-site', 'Match the Figma design'),
    (error) => error.code === 'AI_EDIT_OPERATIONS_INVALID',
  )
  assert.equal(workspace.writes.length, 0)
})

test('does not include Markdown documentation in Figma edit context discovered by search', async () => {
  const requests = []
  const workspace = createWorkspace()
  workspace.files.set('DESIGN_ALIGNMENT.md', 'DO_NOT_SEND_ALIGNMENT_NOTES')
  workspace.searchCode = async () => ({
    results: [{ path: 'DESIGN_ALIGNMENT.md' }],
    truncated: false,
  })
  const provider = createProvider(
    [
      {
        paths: ['frontend/src/App.jsx'],
        rationale: 'The page component contains the banner.',
        searchTerms: ['alignment'],
      },
      {
        operations: [
          {
            content: '',
            path: 'frontend/src/App.jsx',
            replaceAll: false,
            replacement: 'Figma source edit',
            search: 'Old title',
            type: 'replace',
          },
        ],
        summary: 'Updated the source component.',
      },
    ],
    requests,
  )
  const service = new EditService({
    processRegistry: new ProjectProcessRegistry(),
    projectService: createProjectService({ hierarchy: {}, version: 1 }),
    providerFactory: () => provider,
    workspaceFactory: async () => workspace,
  })

  await service.editProject('travel-site', 'Apply the Figma layout')

  assert.equal(requests[1].input.includes('DO_NOT_SEND_ALIGNMENT_NOTES'), false)
  assert.equal(workspace.files.get('DESIGN_ALIGNMENT.md'), 'DO_NOT_SEND_ALIGNMENT_NOTES')
})

test('rejects unsafe AI paths before writing any project file', async () => {
  const requests = []
  const workspace = createWorkspace()
  const provider = createProvider(
    [
      {
        paths: ['frontend/src/App.jsx'],
        rationale: 'Inspect the app',
        searchTerms: [],
      },
      {
        operations: [
          {
            content: 'unsafe',
            path: '../backend/unsafe.js',
            replaceAll: false,
            replacement: '',
            search: '',
            type: 'create',
          },
        ],
        summary: 'Unsafe proposal',
      },
    ],
    requests,
  )
  const service = new EditService({
    processRegistry: new ProjectProcessRegistry(),
    projectService: createProjectService(),
    providerFactory: () => provider,
    workspaceFactory: async () => workspace,
  })

  await assert.rejects(
    service.editProject('travel-site', 'Make an unsafe file'),
    (error) => error.code === 'AI_EDIT_OPERATIONS_INVALID' && error.status === 502,
  )
  assert.equal(workspace.writes.length, 0)
})

test('rejects edits to existing files that were not inspected', async () => {
  const requests = []
  const workspace = createWorkspace()
  const provider = createProvider(
    [
      {
        paths: ['frontend/src/App.jsx'],
        rationale: 'Inspect the app only',
        searchTerms: [],
      },
      {
        operations: [
          {
            content: '',
            path: 'frontend/src/Unrelated.jsx',
            replaceAll: false,
            replacement: 'changed',
            search: 'privateUnrelatedMarker',
            type: 'replace',
          },
        ],
        summary: 'Changed an uninspected file',
      },
    ],
    requests,
  )
  const service = new EditService({
    processRegistry: new ProjectProcessRegistry(),
    projectService: createProjectService(),
    providerFactory: () => provider,
    workspaceFactory: async () => workspace,
  })

  await assert.rejects(
    service.editProject('travel-site', 'Change the other file'),
    (error) => error.code === 'AI_EDIT_OPERATIONS_INVALID',
  )
  assert.equal(workspace.writes.length, 0)
})

test('does not overwrite a file changed after AI inspection', async () => {
  const requests = []
  const workspace = createWorkspace()
  const originalListFiles = workspace.listFiles
  let listingCalls = 0
  workspace.listFiles = async () => {
    listingCalls += 1

    if (listingCalls === 2) {
      workspace.files.set(
        'frontend/src/App.jsx',
        'export default function App() { return <h1>Manual edit</h1> }\n',
      )
    }

    return originalListFiles()
  }
  const provider = createProvider(
    [
      {
        paths: ['frontend/src/App.jsx'],
        rationale: 'Inspect the heading',
        searchTerms: [],
      },
      {
        operations: [
          {
            content: '',
            path: 'frontend/src/App.jsx',
            replaceAll: false,
            replacement: 'AI edit',
            search: 'Old title',
            type: 'replace',
          },
        ],
        summary: 'Changed the title',
      },
    ],
    requests,
  )
  const service = new EditService({
    processRegistry: new ProjectProcessRegistry(),
    projectService: createProjectService(),
    providerFactory: () => provider,
    workspaceFactory: async () => workspace,
  })

  await assert.rejects(
    service.editProject('travel-site', 'Change the heading'),
    (error) => error.code === 'PROJECT_CHANGED_DURING_EDIT',
  )
  assert.equal(workspace.writes.length, 0)
  assert.match(workspace.files.get('frontend/src/App.jsx'), /Manual edit/)
})

test('rejects invalid requests before project or provider access', async () => {
  const service = new EditService({
    projectService: {
      async getProject() {
        throw new Error('Project service must not be called')
      },
    },
  })

  await assert.rejects(
    service.editProject('travel-site', '   '),
    (error) => error.code === 'INVALID_EDIT_REQUEST' && error.status === 400,
  )
})

test('rejects traversal, absolute, protected, and non-portable paths', () => {
  for (const unsafePath of [
    '../backend',
    '../../',
    'project/../../../backend',
    '/outside/project.js',
    'C:/outside/project.js',
    'frontend/node_modules/package.js',
    'frontend/.AI-BUILDER/project.json',
    'frontend/src/invalid?.js',
  ]) {
    assert.throws(
      () => validateEditPath(unsafePath),
      (error) => error.code === 'AI_EDIT_OPERATIONS_INVALID',
    )
  }
})

test('allows an edit beside preview but blocks conflicting project work', () => {
  const registry = new ProjectProcessRegistry()

  assert.equal(
    registry.tryAcquire('travel-site', { id: 'preview', kind: 'preview' }),
    true,
  )
  assert.equal(
    registry.tryAcquire('travel-site', { id: 'edit', kind: 'edit' }),
    true,
  )
  assert.equal(
    registry.tryAcquire('travel-site', { id: 'second-edit', kind: 'edit' }),
    false,
  )
  assert.equal(
    registry.tryAcquire('travel-site', { id: 'build', kind: 'command' }),
    false,
  )
  assert.equal(registry.release('travel-site', 'edit'), true)
  assert.equal(
    registry.tryAcquire('travel-site', { id: 'build', kind: 'command' }),
    false,
  )
  assert.equal(registry.release('travel-site', 'preview'), true)
  assert.equal(
    registry.tryAcquire('travel-site', { id: 'edit-only', kind: 'edit' }),
    true,
  )
  assert.equal(
    registry.tryAcquire('travel-site', { id: 'preview-late', kind: 'preview' }),
    false,
  )
})
