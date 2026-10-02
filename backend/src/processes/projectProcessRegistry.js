class ProjectProcessRegistry {
  constructor() {
    this.processes = new Map()
  }

  list(projectId) {
    return [...(this.processes.get(projectId)?.values() || [])]
  }

  get(projectId) {
    return this.list(projectId)[0] || null
  }

  tryAcquire(projectId, process) {
    const activeProcesses = this.list(projectId)
    const canRunAlongsidePreview =
      ['edit', 'visual-check'].includes(process.kind) &&
      activeProcesses.length > 0 &&
      activeProcesses.every((activeProcess) => activeProcess.kind === 'preview')

    if (activeProcesses.length > 0 && !canRunAlongsidePreview) {
      return false
    }

    const projectProcesses = this.processes.get(projectId) || new Map()
    projectProcesses.set(process.id, process)
    this.processes.set(projectId, projectProcesses)
    return true
  }

  release(projectId, processId) {
    const projectProcesses = this.processes.get(projectId)

    if (projectProcesses?.delete(processId)) {
      if (projectProcesses.size === 0) {
        this.processes.delete(projectId)
      }

      return true
    }

    return false
  }
}

const projectProcessRegistry = new ProjectProcessRegistry()

module.exports = { ProjectProcessRegistry, projectProcessRegistry }
