const path = require('node:path')
const { getWorkspaceConfig } = require('../config/workspace')
const AppError = require('../utils/AppError')
const { validateProjectId } = require('../projects/projectValidation')
const LocalWorkspaceProvider = require('../workspace/localWorkspaceProvider')

class WorkspaceService {
  constructor(provider) {
    this.provider = provider
  }

  getStatus() {
    return this.provider.getStatus()
  }

  listFiles(path, options) {
    return this.provider.listFiles(path, options)
  }

  readFile(path) {
    return this.provider.readFile(path)
  }

  readBinaryFile(path, options) {
    return this.provider.readBinaryFile(path, options)
  }

  writeFile(path, content, options) {
    return this.provider.writeFile(path, content, options)
  }

  writeBinaryFile(path, content, options) {
    return this.provider.writeBinaryFile(path, content, options)
  }

  editFile(path, search, replacement, options) {
    return this.provider.editFile(path, search, replacement, options)
  }

  searchCode(query, path, options) {
    return this.provider.searchCode(query, path, options)
  }

  runCommand(command) {
    return this.provider.runCommand(command)
  }

  startProcess(process) {
    return this.provider.startProcess(process)
  }
}

class ProjectWorkspaceService extends WorkspaceService {
  assertVisiblePath(path = '.') {
    if (
      typeof path === 'string' &&
      path.split(/[\\/]+/).filter(Boolean)[0] === '.ai-builder'
    ) {
      throw new AppError(
        'Builder project metadata is not available to coding tools',
        403,
        'PROJECT_METADATA_PROTECTED',
      )
    }
  }

  listFiles(path, options) {
    this.assertVisiblePath(path)
    return super.listFiles(path, options)
  }

  readFile(path) {
    this.assertVisiblePath(path)
    return super.readFile(path)
  }

  readBinaryFile(path, options) {
    this.assertVisiblePath(path)
    return super.readBinaryFile(path, options)
  }

  writeFile(path, content, options) {
    this.assertVisiblePath(path)
    return super.writeFile(path, content, options)
  }

  writeBinaryFile(path, content, options) {
    this.assertVisiblePath(path)
    return super.writeBinaryFile(path, content, options)
  }

  editFile(path, search, replacement, options) {
    this.assertVisiblePath(path)
    return super.editFile(path, search, replacement, options)
  }

  searchCode(query, path, options) {
    this.assertVisiblePath(path)
    return super.searchCode(query, path, options)
  }
}

function createWorkspaceService() {
  return new WorkspaceService(new LocalWorkspaceProvider(getWorkspaceConfig()))
}

async function createProjectWorkspaceService(projectId) {
  const safeProjectId = validateProjectId(projectId)
  const rootWorkspace = createWorkspaceService()

  try {
    await rootWorkspace.readFile(`${safeProjectId}/.ai-builder/project.json`)
  } catch (error) {
    if (error.code === 'WORKSPACE_PATH_NOT_FOUND') {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND')
    }

    throw error
  }

  const config = getWorkspaceConfig()

  return new ProjectWorkspaceService(
    new LocalWorkspaceProvider({
      ...config,
      rootPath: path.join(config.rootPath, safeProjectId),
    }),
  )
}

module.exports = {
  ProjectWorkspaceService,
  WorkspaceService,
  createProjectWorkspaceService,
  createWorkspaceService,
}
