const assert = require('node:assert/strict')
const http = require('node:http')
const { after, before, test } = require('node:test')
const { VisualCheckService } = require('../src/services/visualCheck.service')

let server
let url

function createWorkspace() {
  const files = new Map()
  return {
    files,
    async readFile(path) {
      if (!files.has(path)) {
        const error = new Error('not found')
        error.code = 'WORKSPACE_PATH_NOT_FOUND'
        throw error
      }
      return { content: files.get(path).toString() }
    },
    async writeBinaryFile(path, content) {
      files.set(path, Buffer.from(content))
    },
    async writeFile(path, content) {
      files.set(path, Buffer.from(content))
    },
  }
}

before(async () => {
  server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html')
    response.end('<!doctype html><title>Visual test</title><main style="width: 900px">Overflow</main>')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  url = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
})

test('uses Chromium to capture rendered previews and detect horizontal overflow', async () => {
  const workspace = createWorkspace()
  const service = new VisualCheckService({
    preview: { async getStatus() { return { status: 'running', url } } },
    processRegistry: { release() {}, tryAcquire() { return true } },
    projectService: {
      async getProject() { return { id: 'visual-test' } },
      async touchProject() {},
    },
    workspace,
  })

  const result = await service.run('visual-test')

  assert.equal(result.screenshots.length, 3)
  assert.equal(result.findings.some((finding) => finding.code === 'HORIZONTAL_OVERFLOW'), true)
  assert.equal(
    [...workspace.files.keys()].filter((path) => path.endsWith('.png')).length,
    3,
  )
})
