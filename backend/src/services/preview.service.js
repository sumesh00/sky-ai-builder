const { randomUUID } = require('node:crypto')
const {
  PREVIEW_HOST,
  PREVIEW_STARTUP_TIMEOUT_MS,
  getPreviewPolicy,
} = require('../preview/previewPolicy')
const {
  allocatePreviewPort,
  waitForPreview,
} = require('../preview/previewNetwork')
const {
  projectProcessRegistry,
} = require('../processes/projectProcessRegistry')
const AppError = require('../utils/AppError')
const { ProjectService } = require('./project.service')
const { createProjectWorkspaceService } = require('./workspace.service')

function publicPreview(record) {
  if (!record) {
    return {
      exitCode: null,
      finishedAt: null,
      output: '',
      port: null,
      projectId: null,
      startedAt: null,
      status: 'stopped',
      terminationReason: null,
      url: null,
    }
  }

  const snapshot = record.handle?.getSnapshot()
  const stdout = snapshot?.stdout || record.stdout || ''
  const stderr = snapshot?.stderr || record.stderr || ''

  return {
    exitCode: snapshot?.exitCode ?? record.exitCode ?? null,
    finishedAt: record.finishedAt || null,
    output: [stdout, stderr].filter(Boolean).join('\n').trim(),
    port: record.port,
    projectId: record.projectId,
    startedAt: record.startedAt,
    status: record.status,
    terminationReason:
      snapshot?.terminationReason || record.terminationReason || null,
    url: record.url,
  }
}

class PreviewService {
  constructor({
    portAllocator = allocatePreviewPort,
    processRegistry = projectProcessRegistry,
    projectService = new ProjectService(),
    readinessCheck = waitForPreview,
    workspaceFactory = createProjectWorkspaceService,
  } = {}) {
    this.portAllocator = portAllocator
    this.portAllocationTail = Promise.resolve()
    this.portReservations = new Set()
    this.previews = new Map()
    this.processRegistry = processRegistry
    this.projectService = projectService
    this.readinessCheck = readinessCheck
    this.workspaceFactory = workspaceFactory
  }

  async reservePort() {
    const previousAllocation = this.portAllocationTail
    let releaseAllocation

    this.portAllocationTail = new Promise((resolve) => {
      releaseAllocation = resolve
    })

    await previousAllocation

    try {
      const port = await this.portAllocator(
        PREVIEW_HOST,
        new Set(this.portReservations),
      )
      this.portReservations.add(port)
      return port
    } finally {
      releaseAllocation()
    }
  }

  async getStatus(projectId) {
    await this.projectService.getProject(projectId)
    const record = this.previews.get(projectId)
    const result = publicPreview(record)

    return { ...result, projectId }
  }

  async start(projectId) {
    await this.projectService.getProject(projectId)

    const existing = this.previews.get(projectId)

    if (existing && ['starting', 'running'].includes(existing.status)) {
      throw new AppError(
        'The project preview is already running',
        409,
        'PREVIEW_ALREADY_RUNNING',
      )
    }

    const processId = randomUUID()

    if (
      !this.processRegistry.tryAcquire(projectId, {
        id: processId,
        kind: 'preview',
      })
    ) {
      throw new AppError(
        'Another project process is already active',
        409,
        'PROJECT_PROCESS_ACTIVE',
      )
    }

    let handle
    let port

    try {
      port = await this.reservePort()
      const workspace = await this.workspaceFactory(projectId)
      handle = await workspace.startProcess(getPreviewPolicy(port))
      const record = {
        finishedAt: null,
        handle,
        port,
        processId,
        projectId,
        startedAt: new Date().toISOString(),
        status: 'starting',
        url: `http://${PREVIEW_HOST}:${port}`,
      }

      this.previews.set(projectId, record)
      handle.exit.then((result) => {
        record.exitCode = result.exitCode
        record.finishedAt = new Date().toISOString()
        record.status =
          result.terminationReason === 'stopped' ? 'stopped' : 'failed'
        record.stderr = result.stderr
        record.stdout = result.stdout
        record.terminationReason = result.terminationReason
        this.portReservations.delete(port)
        this.processRegistry.release(projectId, processId)
      })

      const ready = await this.readinessCheck(
        record.url,
        handle,
        PREVIEW_STARTUP_TIMEOUT_MS,
      )

      if (ready && handle.getSnapshot().status === 'running') {
        record.status = 'running'
        return publicPreview(record)
      }

      if (handle.getSnapshot().status === 'running') {
        await handle.stop('startup_timeout')
      }

      return publicPreview(record)
    } catch (error) {
      if (handle?.getSnapshot().status === 'running') {
        await handle.stop('startup_error')
      }

      if (port) {
        this.portReservations.delete(port)
      }

      this.processRegistry.release(projectId, processId)
      throw error
    }
  }

  async stop(projectId) {
    await this.projectService.getProject(projectId)
    const record = this.previews.get(projectId)

    if (!record || !['starting', 'running'].includes(record.status)) {
      return { ...publicPreview(record), projectId }
    }

    await record.handle.stop('stopped')
    return publicPreview(record)
  }

  async stopAll() {
    const activePreviews = [...this.previews.values()].filter((record) =>
      ['starting', 'running'].includes(record.status),
    )

    await Promise.allSettled(
      activePreviews.map((record) => record.handle.stop('stopped')),
    )
  }
}

const previewService = new PreviewService()

module.exports = { PreviewService, previewService }
