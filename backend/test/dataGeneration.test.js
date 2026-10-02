const assert = require('node:assert/strict')
const { test } = require('node:test')
const { validateDevelopmentPlan } = require('../src/planning/planValidator')
const { buildProjectFiles } = require('../src/projects/projectTemplates')

const plan = {
  assumptions: [],
  authentication: {
    enabled: true,
    roles: [
      { name: 'Central Admin', permissions: ['content:create', 'content:publish'] },
      { name: 'Department User', permissions: ['content:read'] },
    ],
  },
  backendGeneration: { contentTypes: [], provider: 'express' },
  databaseGeneration: {
    entities: [
      { fields: [{ name: 'name', required: true, type: 'string', unique: false }], name: 'Department' },
      { fields: [{ name: 'title', required: true, type: 'string', unique: false }], name: 'Event' },
    ],
    provider: 'sqlite',
    relationships: [{ source: 'Event', target: 'Department', type: 'many-to-one' }],
  },
  projectType: 'full-stack',
  questions: [],
  requirements: ['Department-specific event management'],
  steps: [{ description: 'Generate data layer.', id: 'step-1', status: 'pending', title: 'Create data models' }],
  summary: 'Create a college events platform',
  technology: { backend: ['Node.js', 'Express'], database: ['SQLite', 'Prisma'], frontend: ['React'] },
}

test('generates Prisma models, authentication routes, and role definitions', () => {
  validateDevelopmentPlan(plan)
  const files = buildProjectFiles({ name: 'College Events', plan, projectId: 'college-events', type: 'full-stack' })
  const byPath = new Map(files.map((file) => [file.path, file.content]))

  assert.equal(byPath.has('backend/prisma/schema.prisma'), true)
  assert.match(byPath.get('backend/prisma/schema.prisma'), /model Department/)
  assert.match(byPath.get('backend/prisma/schema.prisma'), /departmentId String/)
  assert.match(byPath.get('backend/prisma/schema.prisma'), /model User/)
  assert.equal(byPath.has('backend/src/auth/auth.routes.js'), true)
  assert.match(byPath.get('backend/src/app.js'), /app\.use\('\/api\/auth', authRoutes\)/)
  assert.match(byPath.get('backend/.env.example'), /JWT_SECRET=/)
})

test('rejects authentication without a database specification', () => {
  const invalid = structuredClone(plan)
  delete invalid.databaseGeneration
  assert.throws(() => validateDevelopmentPlan(invalid), { code: 'AI_PLAN_INVALID' })
})

test('rejects reserved generated model fields', () => {
  const invalid = structuredClone(plan)
  invalid.databaseGeneration.entities[0].fields.push({ name: 'id', required: true, type: 'string', unique: true })
  assert.throws(() => validateDevelopmentPlan(invalid), { code: 'AI_PLAN_INVALID' })
})
