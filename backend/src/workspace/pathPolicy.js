const fs = require('node:fs/promises')
const path = require('node:path')
const AppError = require('../utils/AppError')

function isInside(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath)

  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  )
}

function validateRelativePath(relativePath = '.') {
  if (typeof relativePath !== 'string' || relativePath.includes('\0')) {
    throw new AppError(
      'Workspace paths must be strings without null bytes',
      400,
      'WORKSPACE_PATH_INVALID',
    )
  }

  if (!relativePath || relativePath === '.') {
    return '.'
  }

  if (
    path.isAbsolute(relativePath) ||
    relativePath.split(/[\\/]+/).includes('..')
  ) {
    throw new AppError(
      'Workspace paths must stay inside the authorized workspace',
      403,
      'WORKSPACE_PATH_OUTSIDE_BOUNDARY',
    )
  }

  return relativePath
}

async function lstatIfPresent(targetPath) {
  try {
    return await fs.lstat(targetPath)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null
    }

    throw error
  }
}

class WorkspacePathPolicy {
  constructor(rootPath) {
    this.rootPath = path.resolve(rootPath)
    this.initialization = null
    this.realRootPath = null
  }

  async initialize() {
    if (!this.initialization) {
      this.initialization = fs
        .mkdir(this.rootPath, { recursive: true })
        .then(async () => {
          this.realRootPath = await fs.realpath(this.rootPath)
          return this.realRootPath
        })
    }

    return this.initialization
  }

  async resolve(relativePath = '.', { allowMissing = false } = {}) {
    const safeRelativePath = validateRelativePath(relativePath)
    const targetPath = path.resolve(this.rootPath, safeRelativePath)

    if (!isInside(this.rootPath, targetPath)) {
      throw new AppError(
        'Workspace path resolved outside the authorized workspace',
        403,
        'WORKSPACE_PATH_OUTSIDE_BOUNDARY',
      )
    }

    const realRootPath = await this.initialize()
    const relativeFromRoot = path.relative(this.rootPath, targetPath)
    const segments = relativeFromRoot
      ? relativeFromRoot.split(path.sep).filter(Boolean)
      : []
    let currentPath = this.rootPath
    let nearestExistingPath = this.rootPath
    let targetExists = true

    for (const segment of segments) {
      currentPath = path.join(currentPath, segment)
      const stats = await lstatIfPresent(currentPath)

      if (!stats) {
        targetExists = false
        break
      }

      if (stats.isSymbolicLink()) {
        throw new AppError(
          'Symbolic links and junctions cannot be followed by workspace tools',
          403,
          'WORKSPACE_SYMLINK_FORBIDDEN',
        )
      }

      nearestExistingPath = currentPath
    }

    if (!targetExists && !allowMissing) {
      throw new AppError(
        `Workspace path not found: ${safeRelativePath}`,
        404,
        'WORKSPACE_PATH_NOT_FOUND',
      )
    }

    const realBoundaryTarget = await fs.realpath(nearestExistingPath)

    if (!isInside(realRootPath, realBoundaryTarget)) {
      throw new AppError(
        'Workspace path escaped the authorized workspace boundary',
        403,
        'WORKSPACE_PATH_OUTSIDE_BOUNDARY',
      )
    }

    return {
      absolutePath: targetPath,
      relativePath: safeRelativePath,
    }
  }
}

module.exports = { WorkspacePathPolicy, isInside, validateRelativePath }
