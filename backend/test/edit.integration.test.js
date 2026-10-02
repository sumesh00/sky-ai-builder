const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { after, before, test } = require('node:test')

let apiServer
let apiUrl
let mockProviderServer
let providerRequests = []
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

before(async () => {
  temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-builder-edit-'))
  const projectRoot = path.join(temporaryRoot, 'travel-site')
  await fs.mkdir(path.join(projectRoot, '.ai-builder'), { recursive: true })
  await fs.mkdir(path.join(projectRoot, 'frontend', 'src'), { recursive: true })
  await fs.writeFile(
    path.join(projectRoot, '.ai-builder', 'project.json'),
    JSON.stringify({
      createdAt: new Date().toISOString(),
      id: 'travel-site',
      name: 'Travel Site',
      schemaVersion: 1,
      type: 'frontend',
      updatedAt: new Date().toISOString(),
    }),
  )
  await fs.writeFile(
    path.join(projectRoot, 'frontend', 'src', 'App.jsx'),
    'export default function App() { return <h1>Old title</h1> }\n',
  )
  await fs.writeFile(
    path.join(projectRoot, 'frontend', 'src', 'Unrelated.jsx'),
    'const hiddenMarker = "UNRELATED_CONTEXT_MARKER"\n',
  )

  mockProviderServer = http.createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      const providerRequest = JSON.parse(body)
      providerRequests.push(providerRequest)
      const isSelection =
        providerRequest.text?.format?.name === 'project_edit_file_selection'
      const value = isSelection
        ? {
            paths: ['frontend/src/App.jsx'],
            rationale: 'The heading is in the app component',
            searchTerms: [],
          }
        : {
            operations: [
              {
                content: '',
                path: 'frontend/src/App.jsx',
                replaceAll: false,
                replacement: 'API edited title',
                search: 'Old title',
                type: 'replace',
              },
            ],
            summary: 'Updated the page title.',
          }

      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          id: isSelection ? 'selection-response' : 'edit-response',
          model: 'test-model',
          output: [
            {
              content: [
                { type: 'output_text', text: JSON.stringify(value) },
              ],
              type: 'message',
            },
          ],
        }),
      )
    })
  })

  const providerAddress = await listen(mockProviderServer)
  process.env.WORKSPACE_ROOT = temporaryRoot
  process.env.AI_PROVIDER = 'openai'
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.OPENAI_MODEL = 'test-model'
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${providerAddress.port}`
  process.env.AI_REQUEST_TIMEOUT_MS = '2000'

  const app = require('../src/app')
  apiServer = http.createServer(app)
  const apiAddress = await listen(apiServer)
  apiUrl = `http://127.0.0.1:${apiAddress.port}`
})

after(async () => {
  await close(apiServer)
  await close(mockProviderServer)
  await fs.rm(temporaryRoot, { force: true, recursive: true })

  delete process.env.WORKSPACE_ROOT
  delete process.env.AI_PROVIDER
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_MODEL
  delete process.env.OPENAI_BASE_URL
  delete process.env.AI_REQUEST_TIMEOUT_MS
})

test('edits an active project through the project API', async () => {
  const response = await fetch(`${apiUrl}/api/projects/travel-site/edits`, {
    body: JSON.stringify({ request: 'Change the heading title' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.data.projectId, 'travel-site')
  assert.equal(body.data.validation, 'not_run')
  assert.deepEqual(body.data.changes[0].action, 'updated')

  const updatedFile = await fs.readFile(
    path.join(temporaryRoot, 'travel-site', 'frontend', 'src', 'App.jsx'),
    'utf8',
  )
  assert.match(updatedFile, /API edited title/)
  assert.equal(providerRequests.length, 2)
  assert.equal(providerRequests[1].input.includes('Old title'), true)
  assert.equal(
    providerRequests[1].input.includes('UNRELATED_CONTEXT_MARKER'),
    false,
  )
})

test('edit API rejects an empty request', async () => {
  const response = await fetch(`${apiUrl}/api/projects/travel-site/edits`, {
    body: JSON.stringify({ request: '  ' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.error.code, 'INVALID_EDIT_REQUEST')
})
