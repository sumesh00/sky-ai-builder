const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  ProjectProcessRegistry,
} = require('../src/processes/projectProcessRegistry')
const { PreviewService } = require('../src/services/preview.service')

function createProjectService() {
  return {
    async getProject(projectId) {
      return { id: projectId }
    },
  }
}

function createProcessHandle() {
  let processStatus = 'running'
  let terminationReason = null
  let resolveExit
  const exit = new Promise((resolve) => {
    resolveExit = resolve
  })

  return {
    exit,
    getSnapshot() {
      return {
        exitCode: processStatus === 'running' ? null : 0,
        signal: null,
        status: processStatus,
        stderr: '',
        stdout: 'ready',
        terminationReason,
      }
    },
    async stop(reason) {
      processStatus = 'stopped'
      terminationReason = reason
      const result = {
        exitCode: 0,
        signal: null,
        status: 'stopped',
        stderr: '',
        stdout: 'ready',
        terminationReason: reason,
      }
      resolveExit(result)
      return result
    },
  }
}

test('starts a frontend preview with fixed Vite arguments and stops it', async () => {
  const calls = []
  const processRegistry = new ProjectProcessRegistry()
  const handle = createProcessHandle()
  const service = new PreviewService({
    portAllocator: async () => 5234,
    processRegistry,
    projectService: createProjectService(),
    readinessCheck: async () => true,
    workspaceFactory: async (projectId) => ({
      async startProcess(policy) {
        calls.push({ policy, projectId })
        return handle
      },
    }),
  })

  const started = await service.start('travel-site')

  assert.equal(started.status, 'running')
  assert.equal(started.url, 'http://127.0.0.1:5234')
  assert.equal(calls[0].projectId, 'travel-site')
  assert.deepEqual(calls[0].policy.args.slice(-8), [
    require('node:path').join('node_modules', 'vite', 'bin', 'vite.js'),
    'frontend',
    '--host',
    '127.0.0.1',
    '--port',
    '5234',
    '--strictPort',
  ])
  assert.equal(calls[0].policy.executable, process.execPath)
  assert.equal(processRegistry.get('travel-site').kind, 'preview')

  const stopped = await service.stop('travel-site')

  assert.equal(stopped.status, 'stopped')
  assert.equal(stopped.terminationReason, 'stopped')
  assert.equal(processRegistry.get('travel-site'), null)
})

test('does not start a preview while another project process is active', async () => {
  const processRegistry = new ProjectProcessRegistry()
  processRegistry.tryAcquire('travel-site', {
    id: 'command-1',
    kind: 'command',
  })
  const service = new PreviewService({
    processRegistry,
    projectService: createProjectService(),
    workspaceFactory: async () => {
      throw new Error('The workspace must not be reached')
    },
  })

  await assert.rejects(
    service.start('travel-site'),
    (error) => error.code === 'PROJECT_PROCESS_ACTIVE' && error.status === 409,
  )
})

test('terminates a preview that does not become ready', async () => {
  const handle = createProcessHandle()
  const service = new PreviewService({
    portAllocator: async () => 5235,
    processRegistry: new ProjectProcessRegistry(),
    projectService: createProjectService(),
    readinessCheck: async () => false,
    workspaceFactory: async () => ({
      async startProcess() {
        return handle
      },
    }),
  })

  const result = await service.start('travel-site')

  assert.equal(result.status, 'failed')
  assert.equal(result.terminationReason, 'startup_timeout')
})

test('reserves different ports for previews started concurrently', async () => {
  const handles = new Map()
  const service = new PreviewService({
    portAllocator: async (host, reservedPorts) =>
      reservedPorts.has(5200) ? 5201 : 5200,
    processRegistry: new ProjectProcessRegistry(),
    projectService: createProjectService(),
    readinessCheck: async () => true,
    workspaceFactory: async (projectId) => ({
      async startProcess() {
        const handle = createProcessHandle()
        handles.set(projectId, handle)
        return handle
      },
    }),
  })

  const [first, second] = await Promise.all([
    service.start('first-project'),
    service.start('second-project'),
  ])

  assert.deepEqual(new Set([first.port, second.port]), new Set([5200, 5201]))
  await service.stopAll()
  assert.equal(handles.get('first-project').getSnapshot().status, 'stopped')
  assert.equal(handles.get('second-project').getSnapshot().status, 'stopped')
})
