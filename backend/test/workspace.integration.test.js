const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { after, before, test } = require('node:test')

let apiServer
let apiUrl
let temporaryRoot

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address()))
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

async function post(route, body) {
  const response = await fetch(`${apiUrl}${route}`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return { body: await response.json(), response }
}

before(async () => {
  temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-builder-workspace-'))
  process.env.WORKSPACE_ROOT = temporaryRoot

  const app = require('../src/app')
  const { createWorkspaceService } = require('../src/services/workspace.service')
  const workspace = createWorkspaceService()
  const timestamp = new Date().toISOString()

  await workspace.writeFile(
    'travel-site/.ai-builder/project.json',
    JSON.stringify({
      createdAt: timestamp,
      id: 'travel-site',
      name: 'Travel Site',
      originatingPlan: {},
      schemaVersion: 1,
      type: 'frontend',
      updatedAt: timestamp,
    }),
  )
  apiServer = http.createServer(app)
  const address = await listen(apiServer)
  apiUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await close(apiServer)
  await fs.rm(temporaryRoot, { force: true, recursive: true })
  delete process.env.WORKSPACE_ROOT
})

test('reports workspace capabilities without exposing its absolute root', async () => {
  const response = await fetch(`${apiUrl}/api/workspace/status`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(body, {
    success: true,
    data: {
      capabilities: [
        'listFiles',
        'readFile',
        'readBinaryFile',
        'writeFile',
        'writeBinaryFile',
        'editFile',
        'searchCode',
        'runCommand',
        'startProcess',
      ],
      mode: 'managed',
      provider: 'local',
      ready: true,
    },
  })
  assert.equal(JSON.stringify(body).includes(temporaryRoot), false)
})

test('writes, reads, edits, lists, and searches workspace source files', async () => {
  const created = await post('/api/workspace/tools/write-file', {
    content: 'export const title = "Travel"\n',
    path: 'src/App.js',
    projectId: 'travel-site',
  })

  assert.equal(created.response.status, 201)
  assert.deepEqual(created.body.data, {
    created: true,
    path: 'src/App.js',
    size: 30,
  })

  const read = await post('/api/workspace/tools/read-file', {
    path: 'src/App.js',
    projectId: 'travel-site',
  })

  assert.equal(read.response.status, 200)
  assert.equal(read.body.data.content, 'export const title = "Travel"\n')

  const edited = await post('/api/workspace/tools/edit-file', {
    path: 'src/App.js',
    projectId: 'travel-site',
    replacement: 'Journey',
    search: 'Travel',
  })

  assert.equal(edited.response.status, 200)
  assert.equal(edited.body.data.replacements, 1)

  const search = await post('/api/workspace/tools/search-code', {
    projectId: 'travel-site',
    query: 'journey',
  })

  assert.equal(search.response.status, 200)
  assert.deepEqual(search.body.data.results, [
    {
      column: 23,
      line: 1,
      path: 'src/App.js',
      preview: 'export const title = "Journey"',
    },
  ])

  const listing = await post('/api/workspace/tools/list-files', {
    depth: 4,
    path: '.',
    projectId: 'travel-site',
  })

  assert.equal(listing.response.status, 200)
  assert.deepEqual(
    listing.body.data.entries.map((entry) => [entry.path, entry.type]),
    [
      ['src', 'directory'],
      ['src/App.js', 'file'],
    ],
  )
})

test('requires explicit overwrite permission for existing files', async () => {
  const duplicate = await post('/api/workspace/tools/write-file', {
    content: 'replacement',
    path: 'src/App.js',
    projectId: 'travel-site',
  })

  assert.equal(duplicate.response.status, 409)
  assert.equal(duplicate.body.error.code, 'WORKSPACE_FILE_EXISTS')
})

test('accepts source files larger than the earlier general API body limit', async () => {
  const content = 'a'.repeat(64 * 1024)
  const created = await post('/api/workspace/tools/write-file', {
    content,
    path: 'src/generated.css',
    projectId: 'travel-site',
  })

  assert.equal(created.response.status, 201)
  assert.equal(created.body.data.size, 64 * 1024)

  const read = await post('/api/workspace/tools/read-file', {
    path: 'src/generated.css',
    projectId: 'travel-site',
  })

  assert.equal(read.response.status, 200)
  assert.equal(read.body.data.content.length, 64 * 1024)
})

test('rejects binary control characters in source-file writes', async () => {
  const result = await post('/api/workspace/tools/write-file', {
    content: 'text\u0000binary',
    path: 'src/binary.txt',
    projectId: 'travel-site',
  })

  assert.equal(result.response.status, 415)
  assert.equal(result.body.error.code, 'WORKSPACE_BINARY_FILE')
})

test('rejects parent traversal before accessing the filesystem', async () => {
  const result = await post('/api/workspace/tools/read-file', {
    path: '../outside.txt',
    projectId: 'travel-site',
  })

  assert.equal(result.response.status, 403)
  assert.equal(result.body.error.code, 'WORKSPACE_PATH_OUTSIDE_BOUNDARY')
})

test('rejects symlink and junction paths that could escape the workspace', async (context) => {
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-builder-outside-'))
  const linkPath = path.join(temporaryRoot, 'travel-site', 'outside-link')

  try {
    await fs.symlink(
      outsideRoot,
      linkPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    )
  } catch (error) {
    await fs.rm(outsideRoot, { force: true, recursive: true })
    context.skip(`Symlink creation is unavailable: ${error.code}`)
    return
  }

  try {
    const result = await post('/api/workspace/tools/list-files', {
      path: 'outside-link',
      projectId: 'travel-site',
    })

    assert.equal(result.response.status, 403)
    assert.equal(result.body.error.code, 'WORKSPACE_SYMLINK_FORBIDDEN')
  } finally {
    await fs.rm(linkPath, { force: true, recursive: true })
    await fs.rm(outsideRoot, { force: true, recursive: true })
  }
})
