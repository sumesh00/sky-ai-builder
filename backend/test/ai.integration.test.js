const assert = require('node:assert/strict')
const http = require('node:http')
const { after, before, test } = require('node:test')
const app = require('../src/app')
const { validateDevelopmentPlan } = require('../src/planning/planValidator')

const VALID_PLAN = {
  assumptions: ['The website will initially use static content'],
  projectType: 'frontend',
  questions: [],
  requirements: ['Responsive layout', 'Travel destination cards'],
  steps: [
    {
      description: 'Review the existing frontend structure and conventions.',
      id: 'step-1',
      status: 'pending',
      title: 'Inspect the project',
    },
    {
      description: 'Create the requested responsive page sections.',
      id: 'step-2',
      status: 'pending',
      title: 'Build the interface',
    },
  ],
  summary: 'Create a responsive travel website',
  technology: {
    backend: [],
    database: [],
    frontend: ['React', 'Tailwind CSS'],
  },
}

let apiServer
let apiUrl
let mockProviderServer
let providerUrl
let receivedProviderRequest

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
  mockProviderServer = http.createServer((request, response) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
    })

    request.on('end', () => {
      const parsedBody = JSON.parse(body)

      receivedProviderRequest = {
        authorization: request.headers.authorization,
        body: parsedBody,
        method: request.method,
        url: request.url,
      }

      const outputText = parsedBody.text?.format
        ? JSON.stringify(VALID_PLAN)
        : 'Mock provider response'

      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          id: 'resp_test',
          model: 'test-model',
          output: [
            {
              type: 'message',
              content: [
                { type: 'output_text', text: outputText },
              ],
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

  apiServer = http.createServer(app)
  const apiAddress = await listen(apiServer)
  apiUrl = `http://127.0.0.1:${apiAddress.port}`
})

after(async () => {
  await close(apiServer)
  await close(mockProviderServer)

  delete process.env.AI_PROVIDER
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_MODEL
  delete process.env.OPENAI_BASE_URL
  delete process.env.AI_REQUEST_TIMEOUT_MS
})

test('reports the configured provider without exposing its API key', async () => {
  const response = await fetch(`${apiUrl}/api/ai/status`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(body, {
    success: true,
    data: {
      configured: true,
      model: 'test-model',
      provider: 'openai',
    },
  })
  assert.equal(JSON.stringify(body).includes('test-key'), false)
})

test('sends a prompt through the provider abstraction', async () => {
  const response = await fetch(`${apiUrl}/api/ai/message`, {
    body: JSON.stringify({ message: 'Build a landing page' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(body, {
    success: true,
    data: {
      message: 'Mock provider response',
      model: 'test-model',
      provider: 'openai',
      responseId: 'resp_test',
    },
  })
  assert.equal(receivedProviderRequest.method, 'POST')
  assert.equal(receivedProviderRequest.url, '/responses')
  assert.equal(receivedProviderRequest.authorization, 'Bearer test-key')
  assert.deepEqual(receivedProviderRequest.body, {
    input: 'Build a landing page',
    model: 'test-model',
    store: false,
  })
})

test('rejects an empty prompt before calling the provider', async () => {
  const response = await fetch(`${apiUrl}/api/ai/message`, {
    body: JSON.stringify({ message: '   ' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.success, false)
  assert.equal(body.error.code, 'INVALID_AI_MESSAGE')
})

test('creates and validates a structured development plan', async () => {
  const response = await fetch(`${apiUrl}/api/ai/plan`, {
    body: JSON.stringify({ request: 'Create a responsive travel website' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.data.approved, false)
  assert.equal(typeof body.data.planId, 'string')
  assert.equal(body.data.version, 1)
  assert.equal(body.data.model, 'test-model')
  assert.deepEqual(body.data.plan, VALID_PLAN)
  assert.equal(body.data.provider, 'openai')
  assert.equal(body.data.responseId, 'resp_test')
  assert.equal(receivedProviderRequest.body.input, 'Create a responsive travel website')
  assert.equal(receivedProviderRequest.body.text.format.name, 'development_plan')
  assert.equal(receivedProviderRequest.body.text.format.strict, true)
  assert.equal(receivedProviderRequest.body.text.format.type, 'json_schema')
  assert.equal(receivedProviderRequest.body.instructions.includes('Plan only'), true)
})

test('approves the exact generated plan version', async () => {
  const planResponse = await fetch(`${apiUrl}/api/ai/plan`, {
    body: JSON.stringify({ request: 'Create a responsive travel website' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const planBody = await planResponse.json()
  const approvalResponse = await fetch(
    `${apiUrl}/api/ai/plans/${planBody.data.planId}/approve`,
    {
      body: JSON.stringify({ version: planBody.data.version }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  )
  const approvalBody = await approvalResponse.json()

  assert.equal(approvalResponse.status, 200)
  assert.equal(approvalBody.data.approved, true)
  assert.equal(approvalBody.data.planId, planBody.data.planId)
  assert.equal(approvalBody.data.version, planBody.data.version)
})

test('rejects malformed plans during application validation', () => {
  assert.throws(
    () => validateDevelopmentPlan({ summary: 'Incomplete plan' }),
    (error) => error.code === 'AI_PLAN_INVALID' && error.status === 502,
  )
})
