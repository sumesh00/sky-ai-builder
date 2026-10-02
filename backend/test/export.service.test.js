const assert = require('node:assert/strict')
const { PassThrough } = require('node:stream')
const { test } = require('node:test')
const { ExportService, exportable } = require('../src/services/export.service')

test('excludes private, generated, and dependency paths from exports', () => {
  assert.equal(exportable('frontend/src/App.jsx'), true)
  assert.equal(exportable('.env.example'), true)
  assert.equal(exportable('.env'), false)
  assert.equal(exportable('backend/.env.local'), false)
  assert.equal(exportable('node_modules/react/index.js'), false)
  assert.equal(exportable('.git/config'), false)
  assert.equal(exportable('.ai-builder/references/image.png'), false)
})

test('streams only exportable project files into a ZIP archive', async () => {
  const reads = []
  const workspace = {
    async listFiles() {
      return {
        entries: [
          { path: 'README.md', size: 8, type: 'file' },
          { path: '.env', size: 16, type: 'file' },
          { path: '.env.example', size: 10, type: 'file' },
          { path: '.ai-builder/project.json', size: 10, type: 'file' },
        ],
        truncated: false,
      }
    },
    async readBinaryFile(filePath) {
      reads.push(filePath)
      return { content: Buffer.from(filePath) }
    },
  }
  const output = new PassThrough()
  const chunks = []
  output.on('data', (chunk) => chunks.push(chunk))
  const service = new ExportService({
    projectService: { async getProject() { return { id: 'travel-site' } } },
    workspaceFactory: async () => workspace,
  })

  const result = await service.streamProject('travel-site', output)

  assert.deepEqual(reads, ['README.md', '.env.example'])
  assert.equal(result.fileCount, 2)
  assert.equal(Buffer.concat(chunks).subarray(0, 2).toString(), 'PK')
})
