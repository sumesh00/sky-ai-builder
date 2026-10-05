const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { after, before, test } = require('node:test')

const FRONTEND_PLAN = {
  assumptions: ['Content is initially static'],
  projectType: 'frontend',
  questions: [],
  requirements: ['Responsive navigation', 'Destination cards'],
  steps: [
    {
      description: 'Create the initial responsive interface.',
      id: 'step-1',
      status: 'pending',
      title: 'Build the frontend',
    },
  ],
  summary: 'Create a responsive travel website',
  technology: {
    backend: [],
    database: [],
    frontend: ['React', 'Tailwind CSS'],
  },
}

const FULL_STACK_PLAN = {
  ...FRONTEND_PLAN,
  projectType: 'full-stack',
  summary: 'Create a full-stack travel website',
  technology: {
    backend: ['Node.js', 'Express'],
    database: [],
    frontend: ['React', 'Tailwind CSS'],
  },
}

const GENERATED_APP = `import { useState } from 'react'

const destinations = ['Alpine Lakes', 'Coastal Trails', 'Desert Skies']

export default function App() {
  const [selected, setSelected] = useState(destinations[0])
  return (
    <main>
      <nav aria-label="Primary"><strong>Travel Anchor</strong><a href="#destinations">Destinations</a></nav>
      <section className="hero"><p className="eyebrow">Curated journeys</p><h1>Explore farther.</h1><p>Thoughtful escapes for curious travelers.</p></section>
      <section id="destinations"><h2>Choose your next view</h2>{destinations.map((destination) => <button key={destination} onClick={() => setSelected(destination)}>{destination}</button>)}<p aria-live="polite">Selected: {selected}</p></section>
    </main>
  )
}
`

const GENERATED_CSS = `:root { color: #17332d; background: #f5f1e8; font-family: Arial, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; }
main { min-height: 100vh; }
nav { display: flex; justify-content: space-between; padding: 1.5rem clamp(1rem, 5vw, 5rem); }
.hero { display: grid; min-height: 65vh; place-content: center; padding: 3rem; text-align: center; }
.hero h1 { font-size: clamp(3rem, 10vw, 8rem); margin: 0; }
#destinations { padding: 3rem clamp(1rem, 5vw, 5rem); }
button { margin: .4rem; padding: .8rem 1rem; }
`

let apiServer
let apiUrl
let mockProviderServer
let providerUrl
let temporaryRoot
const generationRequests = []

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

async function createPlan(request, previousPlan) {
  const result = await post('/api/ai/plan', {
    previousPlanId: previousPlan?.planId,
    previousPlanVersion: previousPlan?.version,
    request,
  })

  assert.equal(result.response.status, 200)
  return result.body.data
}

async function approvePlan(plan) {
  const result = await post(`/api/ai/plans/${plan.planId}/approve`, {
    version: plan.version,
  })

  assert.equal(result.response.status, 200)
  return result.body.data
}

before(async () => {
  temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-builder-projects-'))
  process.env.WORKSPACE_ROOT = temporaryRoot

  mockProviderServer = http.createServer((request, response) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
    })

    request.on('end', () => {
      const parsedBody = JSON.parse(body)
      const formatName = parsedBody.text?.format?.name
      let value

      if (formatName === 'website_files') {
        generationRequests.push(parsedBody)
        value = {
          files: [
            { content: GENERATED_APP, path: 'frontend/src/App.jsx' },
            { content: GENERATED_CSS, path: 'frontend/src/index.css' },
          ],
          summary: 'Generated a responsive travel experience.',
        }
      } else {
        value = parsedBody.input.includes('full-stack')
          ? FULL_STACK_PLAN
          : FRONTEND_PLAN
      }

      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          id:
            formatName === 'website_files'
              ? 'resp_website_generation_test'
              : 'resp_project_test',
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
  providerUrl = `http://127.0.0.1:${providerAddress.port}`
  process.env.AI_PROVIDER = 'openai'
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.OPENAI_MODEL = 'test-model'
  process.env.OPENAI_BASE_URL = providerUrl
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

test('blocks project generation until the exact plan is approved', async () => {
  const plan = await createPlan('Create a frontend travel website')
  const result = await post('/api/projects', {
    name: 'Blocked Project',
    planId: plan.planId,
    planVersion: plan.version,
  })

  assert.equal(result.response.status, 409)
  assert.equal(result.body.error.code, 'PLAN_NOT_APPROVED')
})

test('creates a portable frontend-only project from an approved plan', async () => {
  const plan = await createPlan('Create a frontend travel website')
  await approvePlan(plan)

  const result = await post('/api/projects', {
    name: 'Travel Anchor',
    planId: plan.planId,
    planVersion: plan.version,
  })

  assert.equal(result.response.status, 201)
  assert.equal(result.body.data.id, 'travel-anchor')
  assert.equal(result.body.data.name, 'Travel Anchor')
  assert.equal(result.body.data.type, 'frontend')
  assert.equal(result.body.data.originatingPlan.id, plan.planId)
  assert.equal(result.body.data.originatingPlan.version, 1)
  assert.deepEqual(result.body.data.websiteGeneration, {
    model: 'test-model',
    provider: 'openai',
    responseId: 'resp_website_generation_test',
    summary: 'Generated a responsive travel experience.',
  })

  const listing = await post('/api/workspace/tools/list-files', {
    depth: 5,
    path: '.',
    projectId: 'travel-anchor',
  })
  const paths = listing.body.data.entries.map((entry) => entry.path)

  assert.equal(listing.response.status, 200)
  assert.equal(paths.includes('frontend/src/App.jsx'), true)
  assert.equal(paths.includes('frontend/package.json'), true)
  assert.equal(paths.some((filePath) => filePath.startsWith('backend/')), false)
  assert.equal(paths.some((filePath) => filePath.startsWith('.ai-builder')), false)
  const appFile = await post('/api/workspace/tools/read-file', {
    path: 'frontend/src/App.jsx',
    projectId: 'travel-anchor',
  })
  const cssFile = await post('/api/workspace/tools/read-file', {
    path: 'frontend/src/index.css',
    projectId: 'travel-anchor',
  })

  assert.equal(appFile.response.status, 200)
  assert.equal(appFile.body.data.content, GENERATED_APP)
  assert.equal(appFile.body.data.content.includes('Generated project foundation'), false)
  assert.equal(cssFile.response.status, 200)
  assert.equal(cssFile.body.data.content, GENERATED_CSS)
  assert.equal(generationRequests.length, 1)
  assert.deepEqual(JSON.parse(generationRequests[0].input).approvedPlan, FRONTEND_PLAN)
  assert.equal(generationRequests[0].text.format.name, 'website_files')
  await assert.rejects(fs.access(path.join(temporaryRoot, 'travel-anchor', 'node_modules')))
})

test('a regenerated plan has its own unapproved identity', async () => {
  const firstPlan = await createPlan('Create a frontend portfolio')
  await approvePlan(firstPlan)
  const regeneratedPlan = await createPlan(
    'Create a frontend portfolio',
    firstPlan,
  )

  assert.notEqual(regeneratedPlan.planId, firstPlan.planId)

  const result = await post('/api/projects', {
    name: 'Unapproved Regeneration',
    planId: regeneratedPlan.planId,
    planVersion: regeneratedPlan.version,
  })

  assert.equal(result.response.status, 409)
  assert.equal(result.body.error.code, 'PLAN_NOT_APPROVED')

  const oldPlanResult = await post('/api/projects', {
    name: 'Invalidated Old Approval',
    planId: firstPlan.planId,
    planVersion: firstPlan.version,
  })

  assert.equal(oldPlanResult.response.status, 409)
  assert.equal(oldPlanResult.body.error.code, 'PLAN_NOT_APPROVED')
})

test('creates frontend and backend folders for a full-stack plan', async () => {
  const plan = await createPlan('Create a full-stack travel website')
  await approvePlan(plan)

  const result = await post('/api/projects', {
    name: 'Travel Platform',
    planId: plan.planId,
    planVersion: plan.version,
  })

  assert.equal(result.response.status, 201)
  assert.equal(result.body.data.type, 'full-stack')

  const listing = await post('/api/workspace/tools/list-files', {
    depth: 5,
    path: '.',
    projectId: 'travel-platform',
  })
  const paths = listing.body.data.entries.map((entry) => entry.path)

  assert.equal(paths.includes('frontend/src/App.jsx'), true)
  assert.equal(paths.includes('backend/src/app.js'), true)
  assert.equal(paths.includes('backend/src/server.js'), true)
})

test('lists generated projects and returns their metadata', async () => {
  const response = await fetch(`${apiUrl}/api/projects`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.data.length, 2)
  assert.deepEqual(
    new Set(body.data.map((project) => project.id)),
    new Set(['travel-anchor', 'travel-platform']),
  )

  const detailResponse = await fetch(`${apiUrl}/api/projects/travel-anchor`)
  const detailBody = await detailResponse.json()

  assert.equal(detailResponse.status, 200)
  assert.equal(detailBody.data.name, 'Travel Anchor')
  assert.equal(typeof detailBody.data.createdAt, 'string')
  assert.equal(typeof detailBody.data.updatedAt, 'string')
})

test('rejects unsafe names, traversal attempts, and duplicate projects', async () => {
  const plan = await createPlan('Create a frontend website')
  await approvePlan(plan)
  const unsafeNames = [
    '../backend',
    '../../',
    'project/../../../backend',
    path.resolve(temporaryRoot, '..', 'outside-project'),
  ]

  for (const name of unsafeNames) {
    const result = await post('/api/projects', {
      name,
      planId: plan.planId,
      planVersion: plan.version,
    })

    assert.equal(result.response.status, 400)
    assert.equal(result.body.error.code, 'PROJECT_NAME_INVALID')
  }

  const duplicate = await post('/api/projects', {
    name: 'Travel Anchor',
    planId: plan.planId,
    planVersion: plan.version,
  })

  assert.equal(duplicate.response.status, 409)
  assert.equal(duplicate.body.error.code, 'PROJECT_ALREADY_EXISTS')
})

test('project-scoped coding tools cannot escape into siblings or Builder files', async () => {
  for (const unsafePath of [
    '../travel-platform/backend/src/app.js',
    '../../backend/src/app.js',
    'frontend/../../../backend/src/app.js',
    path.resolve(temporaryRoot, '..', 'backend', 'src', 'app.js'),
  ]) {
    const result = await post('/api/workspace/tools/read-file', {
      path: unsafePath,
      projectId: 'travel-anchor',
    })

    assert.equal(result.response.status, 403)
    assert.equal(result.body.error.code, 'WORKSPACE_PATH_OUTSIDE_BOUNDARY')
  }

  const metadataResult = await post('/api/workspace/tools/read-file', {
    path: '.ai-builder/project.json',
    projectId: 'travel-anchor',
  })

  assert.equal(metadataResult.response.status, 403)
  assert.equal(metadataResult.body.error.code, 'PROJECT_METADATA_PROTECTED')
})

test('exposes only the fixed Phase 7 command policy', async () => {
  const capabilitiesResponse = await fetch(
    `${apiUrl}/api/projects/travel-anchor/commands`,
  )
  const capabilities = await capabilitiesResponse.json()

  assert.equal(capabilitiesResponse.status, 200)
  assert.deepEqual(
    capabilities.data.actions.map((action) => action.id),
    ['install', 'build'],
  )
  assert.equal(
    capabilities.data.actions.every((action) => action.requiresConfirmation),
    true,
  )

  const unconfirmed = await post('/api/projects/travel-anchor/commands', {
    action: 'build',
  })

  assert.equal(unconfirmed.response.status, 400)
  assert.equal(
    unconfirmed.body.error.code,
    'COMMAND_CONFIRMATION_REQUIRED',
  )

  const rejected = await post('/api/projects/travel-anchor/commands', {
    action: 'npm run dev && echo unsafe',
    confirmed: true,
  })

  assert.equal(rejected.response.status, 400)
  assert.equal(rejected.body.error.code, 'COMMAND_NOT_ALLOWED')
})

test('reports stopped preview state and requires confirmation to start', async () => {
  const statusResponse = await fetch(
    `${apiUrl}/api/projects/travel-anchor/preview`,
  )
  const status = await statusResponse.json()

  assert.equal(statusResponse.status, 200)
  assert.equal(status.data.projectId, 'travel-anchor')
  assert.equal(status.data.status, 'stopped')
  assert.equal(status.data.url, null)

  const unconfirmed = await post(
    '/api/projects/travel-anchor/preview/start',
    {},
  )

  assert.equal(unconfirmed.response.status, 400)
  assert.equal(
    unconfirmed.body.error.code,
    'PREVIEW_CONFIRMATION_REQUIRED',
  )
})

test('returns a bounded static responsive audit for a generated project', async () => {
  const result = await post('/api/projects/travel-anchor/responsive-audit', {})

  assert.equal(result.response.status, 200)
  assert.equal(result.body.success, true)
  assert.equal(result.body.data.projectId, 'travel-anchor')
  assert.equal(result.body.data.viewports.length, 7)
  assert.equal(result.body.data.limitations.includes('Static source review'), true)
  assert.equal(result.body.data.analyzedFiles.includes('frontend/src/App.jsx'), true)
  assert.equal(result.body.data.findings.some((finding) => finding.severity === 'error'), false)
})

test('lists local project versions and requires confirmation before restore', async () => {
  const versionsResponse = await fetch(`${apiUrl}/api/projects/travel-anchor/versions`)
  const versions = await versionsResponse.json()

  assert.equal(versionsResponse.status, 200)
  assert.equal(versions.data.length >= 1, true)

  const restore = await post(
    `/api/projects/travel-anchor/versions/${versions.data[0].id}/restore`,
    {},
  )

  assert.equal(restore.response.status, 400)
  assert.equal(restore.body.error.code, 'GIT_RESTORE_CONFIRMATION_REQUIRED')
})

test('exports generated project source as a ZIP archive', async () => {
  const response = await fetch(`${apiUrl}/api/projects/travel-anchor/export`)
  const archive = Buffer.from(await response.arrayBuffer())

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/zip')
  assert.equal(response.headers.get('content-disposition').includes('travel-anchor.zip'), true)
  assert.equal(archive.subarray(0, 2).toString(), 'PK')
})
