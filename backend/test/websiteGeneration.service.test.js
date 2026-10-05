const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  MAX_GENERATED_FILE_BYTES,
  validateWebsiteGeneration,
} = require('../src/generation/websiteGenerationValidator')
const {
  WebsiteGenerationService,
} = require('../src/services/websiteGeneration.service')
const { ProjectService } = require('../src/services/project.service')

const APP_SOURCE = `import { useState } from 'react'

export default function App() {
  const [open, setOpen] = useState(false)
  return <main><button onClick={() => setOpen(!open)}>Explore</button></main>
}
`
const CSS_SOURCE = ':root { color: #172554; }\nmain { min-height: 100vh; }\n'

function generatedValue(overrides = {}) {
  return {
    files: [
      { content: APP_SOURCE, path: 'frontend/src/App.jsx' },
      { content: CSS_SOURCE, path: 'frontend/src/index.css' },
    ],
    summary: 'Built the approved responsive experience.',
    ...overrides,
  }
}

test('generates the two frontend files from the approved plan with a mocked provider', async () => {
  const requests = []
  const provider = {
    async generateStructured(request) {
      requests.push(request)
      return {
        model: 'mock-model',
        provider: 'mock-openai',
        responseId: 'resp_generated',
        value: generatedValue(),
      }
    },
  }
  const service = new WebsiteGenerationService({
    providerFactory: () => provider,
  })
  const result = await service.generate({
    approvedPlan: {
      plan: {
        projectType: 'frontend',
        requirements: ['Responsive navigation'],
        summary: 'Create a travel site',
      },
      request: 'Build a polished travel site',
    },
    name: 'Travel Anchor',
  })

  assert.deepEqual(
    result.files.map((file) => file.path),
    ['frontend/src/App.jsx', 'frontend/src/index.css'],
  )
  assert.equal(result.provider, 'mock-openai')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].name, 'website_files')
  assert.equal(requests[0].schema.properties.files.minItems, 2)
  assert.equal(requests[0].instructions.includes('Do not add or require packages'), true)
  assert.deepEqual(JSON.parse(requests[0].input), {
    approvedPlan: {
      projectType: 'frontend',
      requirements: ['Responsive navigation'],
      summary: 'Create a travel site',
    },
    originalRequest: 'Build a polished travel site',
    project: { name: 'Travel Anchor', type: 'frontend' },
  })
})

test('accepts files in either order and normalizes them to the fixed target order', () => {
  const value = generatedValue()
  value.files.reverse()

  assert.deepEqual(
    validateWebsiteGeneration(value).files.map((file) => file.path),
    ['frontend/src/App.jsx', 'frontend/src/index.css'],
  )
})

test('rejects missing, duplicate, extra, and unsafe output paths', () => {
  const invalidFileSets = [
    [{ content: APP_SOURCE, path: 'frontend/src/App.jsx' }],
    [
      { content: APP_SOURCE, path: 'frontend/src/App.jsx' },
      { content: APP_SOURCE, path: 'frontend/src/App.jsx' },
    ],
    [
      { content: APP_SOURCE, path: 'frontend/src/App.jsx' },
      { content: CSS_SOURCE, path: '../index.css' },
    ],
    [
      { content: APP_SOURCE, path: 'frontend/src/App.jsx' },
      { content: CSS_SOURCE, path: 'frontend/src/index.css' },
      { content: 'secret', path: '.env' },
    ],
  ]

  for (const files of invalidFileSets) {
    assert.throws(
      () => validateWebsiteGeneration(generatedValue({ files })),
      (error) =>
        error.code === 'AI_WEBSITE_GENERATION_INVALID' && error.status === 502,
    )
  }
})

test('rejects unsafe, dependency-backed, fenced, and oversized file content', () => {
  const invalidContents = [
    {
      content: "import icons from 'icon-package'\nexport default function App() { return <main /> }",
      path: 'frontend/src/App.jsx',
    },
    {
      content: 'export default function App() { return <main dangerouslySetInnerHTML={{ __html: value }} /> }',
      path: 'frontend/src/App.jsx',
    },
    {
      content: '```jsx\nexport default function App() { return <main /> }\n```',
      path: 'frontend/src/App.jsx',
    },
    {
      content: `export default function App() { return <main>${'x'.repeat(MAX_GENERATED_FILE_BYTES)}</main> }`,
      path: 'frontend/src/App.jsx',
    },
    {
      content: '@import "remote.css";\nmain { color: red; }',
      path: 'frontend/src/index.css',
    },
  ]

  for (const invalidFile of invalidContents) {
    const value = generatedValue()
    value.files = value.files.map((file) =>
      file.path === invalidFile.path ? invalidFile : file,
    )

    assert.throws(
      () => validateWebsiteGeneration(value),
      (error) => error.code === 'AI_WEBSITE_GENERATION_INVALID',
    )
  }
})

test('writes no project files when the mocked provider returns invalid generation output', async () => {
  const writes = []
  const workspace = {
    async listFiles() {
      return { entries: [] }
    },
    async writeFile(path, content, options) {
      writes.push({ content, options, path })
    },
  }
  const generation = new WebsiteGenerationService({
    providerFactory: () => ({
      async generateStructured() {
        return {
          model: 'mock-model',
          provider: 'mock-openai',
          responseId: 'resp_invalid',
          value: generatedValue({
            files: [
              { content: APP_SOURCE, path: 'frontend/src/App.jsx' },
              { content: CSS_SOURCE, path: '../outside.css' },
            ],
          }),
        }
      },
    }),
  })
  const plans = {
    requireApproved() {
      return {
        id: 'approved-plan',
        model: 'mock-model',
        plan: { projectType: 'frontend' },
        provider: 'mock-openai',
        request: 'Build a safe site',
        responseId: 'resp_plan',
        version: 1,
      }
    },
  }
  const service = new ProjectService({
    plans,
    websiteGeneration: generation,
    workspace,
  })

  await assert.rejects(
    service.createProject({
      name: 'Safe Site',
      planId: 'approved-plan',
      planVersion: 1,
    }),
    (error) => error.code === 'AI_WEBSITE_GENERATION_INVALID',
  )
  assert.equal(writes.length, 0)
})
