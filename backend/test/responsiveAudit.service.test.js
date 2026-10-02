const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  analyzeResponsiveSources,
} = require('../src/responsive/responsiveAnalyzer')
const {
  ResponsiveAuditService,
} = require('../src/services/responsiveAudit.service')

function file(path, content) {
  return { content, path, size: Buffer.byteLength(content) }
}

test('finds likely responsive issues in bounded frontend source files', () => {
  const analysis = analyzeResponsiveSources([
    file('frontend/index.html', '<html><head></head><body></body></html>'),
    file(
      'frontend/src/page.css',
      '.hero { width: 1200px; position: absolute; }\n.cards { grid-template-columns: repeat(4, 1fr); }',
    ),
    file(
      'frontend/src/App.jsx',
      '<div className="grid-cols-4 w-[900px]"><img src="hero.jpg" /></div>',
    ),
  ])

  assert.deepEqual(
    new Set(analysis.findings.map((finding) => finding.code)),
    new Set([
      'missing-viewport-meta',
      'image-scaling-review',
      'fixed-width',
      'absolute-layout',
      'fixed-grid-columns',
      'tailwind-fixed-grid',
      'tailwind-fixed-width',
    ]),
  )
  assert.equal(analysis.findings[0].severity, 'error')
})

test('does not report a responsive baseline as a risk', () => {
  const analysis = analyzeResponsiveSources([
    file(
      'frontend/index.html',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    ),
    file('frontend/src/index.css', 'img { max-width: 100%; height: auto; }'),
    file('frontend/src/App.jsx', '<main><img src="hero.jpg" /></main>'),
  ])

  assert.deepEqual(analysis.findings, [])
})

test('uses the project-scoped workspace to return a responsive audit', async () => {
  const calls = []
  const service = new ResponsiveAuditService({
    projectService: {
      async getProject(projectId) {
        return { id: projectId }
      },
    },
    workspaceFactory: async () => ({
      async listFiles(path, options) {
        calls.push({ options, path })
        return {
          entries: [
            { path: 'frontend/index.html', size: 70, type: 'file' },
            { path: 'frontend/src/App.jsx', size: 20, type: 'file' },
            { path: 'backend/src/server.js', size: 20, type: 'file' },
          ],
        }
      },
      async readFile(path) {
        const content =
          path === 'frontend/index.html'
            ? '<meta name="viewport" content="width=device-width" />'
            : '<main />'
        return { content, path, size: Buffer.byteLength(content) }
      },
    }),
  })

  const result = await service.auditProject('travel-site')

  assert.equal(calls[0].path, 'frontend')
  assert.equal(calls[0].options.depth, 10)
  assert.equal(result.projectId, 'travel-site')
  assert.equal(result.viewports.length, 7)
  assert.deepEqual(result.analyzedFiles, [
    'frontend/index.html',
    'frontend/src/App.jsx',
  ])
  assert.deepEqual(result.summary, { error: 0, info: 0, warning: 0 })
})
