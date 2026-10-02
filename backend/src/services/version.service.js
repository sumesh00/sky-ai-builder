const AppError = require('../utils/AppError')
const { createProjectWorkspaceService } = require('./workspace.service')

const GIT_TIMEOUT_MS = 15000
const GIT_MAX_OUTPUT_BYTES = 128 * 1024
const MAX_VERSIONS = 50

function gitPolicy(args, { maxOutputBytes = GIT_MAX_OUTPUT_BYTES } = {}) {
  return { args, executable: 'git', maxOutputBytes, timeoutMs: GIT_TIMEOUT_MS }
}

function revision(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{7,64}$/i.test(value)) {
    throw new AppError('The Git revision is invalid', 400, 'GIT_REVISION_INVALID')
  }
  return value
}

function commitMessage(value, fallback) {
  if (value === undefined || value === '') return fallback
  if (typeof value !== 'string' || value.length > 120 || /[\r\n\0]/.test(value)) {
    throw new AppError('Version messages must contain 1 to 120 plain-text characters', 400, 'GIT_MESSAGE_INVALID')
  }
  return value.trim() || fallback
}

function parseVersions(output) {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, message, createdAt] = line.split('\u001f')
      return { createdAt, id, message }
    })
    .filter((item) => /^[a-f0-9]{40}$/i.test(item.id))
}

class VersionService {
  constructor({ workspaceFactory = createProjectWorkspaceService } = {}) {
    this.workspaceFactory = workspaceFactory
  }

  async run(workspace, args, options) {
    const result = await workspace.runCommand(gitPolicy(args, options))
    if (result.status !== 'succeeded') {
      throw new AppError(
        result.stderr || result.stdout || 'Git could not complete the version operation',
        502,
        'GIT_OPERATION_FAILED',
      )
    }
    return result
  }

  async initialize(projectId) {
    const workspace = await this.workspaceFactory(projectId)
    await this.run(workspace, ['init'])
    await this.run(workspace, ['config', 'user.name', 'AI Website Builder'])
    await this.run(workspace, ['config', 'user.email', 'ai-website-builder@local'])
    await this.run(workspace, ['add', '--all'])
    await this.run(workspace, ['commit', '--message', 'Initial generation'])
    return { initializedAt: new Date().toISOString(), provider: 'git', status: 'ready' }
  }

  async list(projectId, existingWorkspace) {
    const workspace = existingWorkspace || await this.workspaceFactory(projectId)
    const result = await this.run(workspace, ['log', `-n${MAX_VERSIONS}`, '--format=%H%x1f%s%x1f%aI'])
    return parseVersions(result.stdout)
  }

  async snapshot(projectId, message) {
    const workspace = await this.workspaceFactory(projectId)
    const status = await this.run(workspace, ['status', '--porcelain'])
    if (!status.stdout.trim()) {
      return { created: false, reason: 'no_changes', version: (await this.list(projectId, workspace))[0] || null }
    }
    await this.run(workspace, ['add', '--all'])
    await this.run(workspace, ['commit', '--message', commitMessage(message, 'AI Website Builder snapshot')])
    return { created: true, version: (await this.list(projectId, workspace))[0] }
  }

  async diff(projectId, baseRevision) {
    const workspace = await this.workspaceFactory(projectId)
    const base = revision(baseRevision)
    const result = await this.run(workspace, ['diff', '--stat', `${base}..HEAD`], { maxOutputBytes: 64 * 1024 })
    return { baseRevision: base, currentRevision: (await this.list(projectId, workspace))[0]?.id || null, summary: result.stdout.trim() || 'No file differences.' }
  }

  async restore(projectId, targetRevision) {
    const workspace = await this.workspaceFactory(projectId)
    const target = revision(targetRevision)
    await this.snapshot(projectId, `Snapshot before restore to ${target.slice(0, 7)}`)
    await this.run(workspace, ['restore', '--source', target, '--staged', '--worktree', '.'])
    const status = await this.run(workspace, ['status', '--porcelain'])
    if (!status.stdout.trim()) {
      return { restored: false, targetRevision: target, version: (await this.list(projectId, workspace))[0] || null }
    }
    await this.run(workspace, ['add', '--all'])
    await this.run(workspace, ['commit', '--message', `Restore ${target.slice(0, 7)}`])
    return { restored: true, targetRevision: target, version: (await this.list(projectId, workspace))[0] }
  }
}

const versionService = new VersionService()

module.exports = { VersionService, versionService }
