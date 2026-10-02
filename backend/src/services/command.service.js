const { randomUUID } = require('node:crypto')
const {
  getCommandPolicy,
  listCommandPolicies,
} = require('../commands/commandPolicy')
const AppError = require('../utils/AppError')
const {
  projectProcessRegistry,
} = require('../processes/projectProcessRegistry')
const { ProjectService } = require('./project.service')
const { createProjectWorkspaceService } = require('./workspace.service')

class CommandService {
  constructor({
    processRegistry = projectProcessRegistry,
    projectService = new ProjectService(),
    workspaceFactory = createProjectWorkspaceService,
  } = {}) {
    this.processRegistry = processRegistry
    this.projectService = projectService
    this.workspaceFactory = workspaceFactory
  }

  async getCapabilities(projectId) {
    await this.projectService.getProject(projectId)

    const activeProcesses = this.processRegistry.list(projectId)
    const activeCommand = activeProcesses.find(
      (activeProcess) => activeProcess.kind === 'command',
    )

    return {
      actions: listCommandPolicies(),
      activeAction: activeCommand?.action || null,
      blockedByPreview: activeProcesses.some(
        (activeProcess) => activeProcess.kind === 'preview',
      ),
      projectId,
    }
  }

  async run(projectId, action) {
    await this.projectService.getProject(projectId)
    const policy = getCommandPolicy(action)

    const commandId = randomUUID()
    const startedAt = new Date().toISOString()

    if (
      !this.processRegistry.tryAcquire(projectId, {
        action,
        id: commandId,
        kind: 'command',
        startedAt,
      })
    ) {
      throw new AppError(
        'Another project process is already active',
        409,
        'COMMAND_ALREADY_RUNNING',
      )
    }

    try {
      const workspace = await this.workspaceFactory(projectId)
      const execution = await workspace.runCommand(policy)

      await this.projectService.touchProject(projectId)

      return {
        action,
        commandId,
        finishedAt: new Date().toISOString(),
        projectId,
        startedAt,
        ...execution,
      }
    } finally {
      this.processRegistry.release(projectId, commandId)
    }
  }
}

const commandService = new CommandService()

module.exports = { CommandService, commandService }
