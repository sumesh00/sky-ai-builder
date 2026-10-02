const assert = require('node:assert/strict')
const { test } = require('node:test')
const { VisualCheckService } = require('../src/services/visualCheck.service')

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

function createBrowser() {
  return {
    async close() {},
    async newPage() {
      const listeners = new Map()
      return {
        async close() {},
        async evaluate() {
          return {
            documentHeight: 900,
            horizontalOverflow: false,
            overflowElements: [],
            viewportWidth: 390,
          }
        },
        async goto() {},
        on(event, callback) {
          listeners.set(event, callback)
        },
        async screenshot() {
          return Buffer.from('png')
        },
      }
    },
  }
}

test('captures a bounded screenshot for each visual-check viewport', async () => {
  const workspace = createWorkspace()
  const registry = {
    releaseCalls: 0,
    release() {
      this.releaseCalls += 1
    },
    tryAcquire() {
      return true
    },
  }
  const service = new VisualCheckService({
    browserLauncher: async () => createBrowser(),
    preview: { async getStatus() { return { status: 'running', url: 'http://127.0.0.1:5200' } } },
    processRegistry: registry,
    projectService: {
      async getProject() { return { id: 'travel-site' } },
      async touchProject() {},
    },
    workspace,
  })

  const result = await service.run('travel-site')

  assert.equal(result.screenshots.length, 3)
  assert.equal(result.findings.length, 0)
  assert.equal(
    [...workspace.files.keys()].some((path) => path.includes('.ai-builder/visual-checks/')),
    true,
  )
  assert.equal(registry.releaseCalls, 1)
})

test('requires an existing running preview before launching Chromium', async () => {
  const service = new VisualCheckService({
    browserLauncher: async () => {
      throw new Error('browser should not launch')
    },
    preview: { async getStatus() { return { status: 'stopped', url: null } } },
    projectService: { async getProject() { return { id: 'travel-site' } } },
  })

  await assert.rejects(() => service.run('travel-site'), {
    code: 'PREVIEW_NOT_RUNNING',
  })
})
