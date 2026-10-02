const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  ProjectProcessRegistry,
} = require('../src/processes/projectProcessRegistry')
const { CommandService } = require('../src/services/command.service')

function createProjectService() {
  return {
    async getProject(projectId) {
      return { id: projectId }
    },
    async touchProject(projectId) {
      return { id: projectId }
    },
  }
}

test('maps allowed command actions to fixed executable arguments', async () => {
  const calls = []
  const service = new CommandService({
    projectService: createProjectService(),
    workspaceFactory: async (projectId) => ({
      async runCommand(command) {
        calls.push({ command, projectId })
        return {
          durationMs: 10,
          exitCode: 0,
          signal: null,
          status: 'succeeded',
          stderr: '',
          stdout: 'done',
          terminationReason: null,
        }
      },
    }),
  })

  const install = await service.run('travel-site', 'install')
  const build = await service.run('travel-site', 'build')

  assert.equal(install.status, 'succeeded')
  assert.equal(build.status, 'succeeded')
  assert.deepEqual(calls[0].command.args.slice(-4), [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ])
  assert.deepEqual(calls[1].command.args.slice(-4), [
    'run',
    'build',
    '--workspace',
    'frontend',
  ])
  if (process.platform === 'win32') {
    assert.equal(calls[0].command.executable, process.execPath)
    assert.equal(calls[0].command.args[0].endsWith('npm-cli.js'), true)
  } else {
    assert.equal(calls[0].command.executable, 'npm')
  }
})

test('rejects arbitrary executables, scripts, and shell syntax', async () => {
  const service = new CommandService({
    projectService: createProjectService(),
    workspaceFactory: async () => {
      throw new Error('The workspace must not be reached for rejected commands')
    },
  })

  for (const action of [
    'npm run dev',
    'rm -rf .',
    'install && echo unsafe',
    '../build',
    '',
  ]) {
    await assert.rejects(
      service.run('travel-site', action),
      (error) => error.code === 'COMMAND_NOT_ALLOWED' && error.status === 400,
    )
  }
})

test('allows only one active command per project', async () => {
  let releaseCommand
  const runningCommand = new Promise((resolve) => {
    releaseCommand = resolve
  })
  const service = new CommandService({
    projectService: createProjectService(),
    workspaceFactory: async () => ({
      async runCommand() {
        await runningCommand
        return {
          durationMs: 10,
          exitCode: 0,
          signal: null,
          status: 'succeeded',
          stderr: '',
          stdout: '',
          terminationReason: null,
        }
      },
    }),
  })

  const firstCommand = service.run('travel-site', 'build')

  await new Promise((resolve) => setImmediate(resolve))
  await assert.rejects(
    service.run('travel-site', 'install'),
    (error) => error.code === 'COMMAND_ALREADY_RUNNING' && error.status === 409,
  )

  releaseCommand()
  await firstCommand
})

test('blocks finite commands while a preview is active', async () => {
  const processRegistry = new ProjectProcessRegistry()
  processRegistry.tryAcquire('travel-site', {
    id: 'preview-1',
    kind: 'preview',
  })
  const service = new CommandService({
    processRegistry,
    projectService: createProjectService(),
    workspaceFactory: async () => {
      throw new Error('The workspace must not be reached')
    },
  })

  await assert.rejects(
    service.run('travel-site', 'build'),
    (error) => error.code === 'COMMAND_ALREADY_RUNNING' && error.status === 409,
  )
})
