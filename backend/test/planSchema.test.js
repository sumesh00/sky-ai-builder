const assert = require('node:assert/strict')
const { test } = require('node:test')
const { DEVELOPMENT_PLAN_SCHEMA } = require('../src/planning/planSchema')
const { validateDevelopmentPlan } = require('../src/planning/planValidator')

test('uses required nullable fields for optional structured-plan capabilities', () => {
  assert.equal(DEVELOPMENT_PLAN_SCHEMA.required.includes('authentication'), true)
  assert.equal(DEVELOPMENT_PLAN_SCHEMA.required.includes('backendGeneration'), true)
  assert.equal(DEVELOPMENT_PLAN_SCHEMA.required.includes('databaseGeneration'), true)
  assert.deepEqual(DEVELOPMENT_PLAN_SCHEMA.properties.authentication.type, ['object', 'null'])
})

test('accepts null optional plan capabilities but rejects malformed values', () => {
  const plan = {
    assumptions: [],
    authentication: null,
    backendGeneration: null,
    databaseGeneration: null,
    projectType: 'frontend',
    questions: [],
    requirements: ['A responsive homepage'],
    steps: [{ description: 'Create the UI.', id: 'step-1', status: 'pending', title: 'Build interface' }],
    summary: 'Create a homepage',
    technology: { backend: [], database: [], frontend: ['React'] },
  }
  assert.equal(validateDevelopmentPlan(plan), plan)
  plan.authentication = false
  assert.throws(() => validateDevelopmentPlan(plan), { code: 'AI_PLAN_INVALID' })
})
