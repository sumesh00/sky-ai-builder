const assert = require('node:assert/strict')
const { test } = require('node:test')
const { validateDevelopmentPlan } = require('../src/planning/planValidator')
const { buildProjectFiles } = require('../src/projects/projectTemplates')

const plan = {
  assumptions: [],
  backendGeneration: {
    contentTypes: [
      {
        fields: [
          { name: 'Title', required: true, type: 'string' },
          { name: 'Published At', required: false, type: 'datetime' },
        ],
        name: 'News',
      },
    ],
    provider: 'strapi',
  },
  projectType: 'full-stack',
  questions: [],
  requirements: ['Publish news articles'],
  steps: [{ description: 'Create content types.', id: 'step-1', status: 'pending', title: 'Create CMS' }],
  summary: 'Create a news site',
  technology: { backend: ['Strapi'], database: [], frontend: ['React'] },
}

test('creates a normal Strapi content-type scaffold from an approved plan shape', () => {
  validateDevelopmentPlan(plan)
  const files = buildProjectFiles({ name: 'News Portal', plan, projectId: 'news-portal', type: 'full-stack' })
  const paths = files.map((file) => file.path)
  const schema = files.find((file) => file.path.endsWith('/news/schema.json'))

  assert.equal(paths.includes('backend/package.json'), true)
  assert.equal(paths.includes('backend/config/database.js'), true)
  assert.equal(schema !== undefined, true)
  assert.equal(schema.content.includes('published_at'), true)
  assert.equal(paths.includes('backend/src/server.js'), false)
})

test('creates Express content routes when requested', () => {
  const expressPlan = structuredClone(plan)
  expressPlan.backendGeneration.provider = 'express'
  expressPlan.technology.backend = ['Node.js', 'Express']
  const files = buildProjectFiles({ name: 'News Portal', plan: expressPlan, projectId: 'news-portal', type: 'full-stack' })
  const app = files.find((file) => file.path === 'backend/src/app.js')

  assert.equal(files.some((file) => file.path === 'backend/src/routes/content.routes.js'), true)
  assert.equal(app.content.includes("app.use('/api/content-types', contentRoutes)"), true)
})

test('rejects backend generation on a frontend-only plan', () => {
  const invalid = structuredClone(plan)
  invalid.projectType = 'frontend'
  assert.throws(() => validateDevelopmentPlan(invalid), { code: 'AI_PLAN_INVALID' })
})
