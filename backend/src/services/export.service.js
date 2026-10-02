const { ZipArchive } = require('archiver')
const AppError = require('../utils/AppError')
const { ProjectService } = require('./project.service')
const { createProjectWorkspaceService } = require('./workspace.service')

const MAX_EXPORT_BYTES = 50 * 1024 * 1024
const MAX_EXPORT_FILE_BYTES = 10 * 1024 * 1024
const MAX_EXPORT_FILES = 500
const EXCLUDED_DIRECTORIES = new Set(['.ai-builder', '.git', 'build', 'dist', 'node_modules'])

function exportable(path) {
  const segments = path.split('/')
  const name = segments.at(-1)
  return !segments.some((segment) => EXCLUDED_DIRECTORIES.has(segment)) &&
    !(name === '.env' || (name.startsWith('.env.') && name !== '.env.example'))
}

class ExportService {
  constructor({
    projectService = new ProjectService(),
    workspaceFactory = createProjectWorkspaceService,
  } = {}) {
    this.projectService = projectService
    this.workspaceFactory = workspaceFactory
  }

  async streamProject(projectId, output) {
    const project = await this.projectService.getProject(projectId)
    const workspace = await this.workspaceFactory(project.id)
    const listing = await workspace.listFiles('.', { depth: 10 })
    const files = listing.entries.filter((entry) => entry.type === 'file' && exportable(entry.path))

    if (listing.truncated || files.length > MAX_EXPORT_FILES) {
      throw new AppError('Project has too many files to export safely', 413, 'EXPORT_FILE_LIMIT')
    }

    const totalSize = files.reduce((total, file) => total + file.size, 0)
    if (totalSize > MAX_EXPORT_BYTES || files.some((file) => file.size > MAX_EXPORT_FILE_BYTES)) {
      throw new AppError('Project is too large to export safely', 413, 'EXPORT_SIZE_LIMIT')
    }

    const archive = new ZipArchive({ zlib: { level: 9 } })
    const completed = new Promise((resolve, reject) => {
      archive.once('error', reject)
      output.once('error', reject)
      output.once('finish', resolve)
    })
    archive.pipe(output)

    for (const file of files) {
      const content = await workspace.readBinaryFile(file.path, { maxBytes: MAX_EXPORT_FILE_BYTES })
      archive.append(content.content, { name: file.path })
    }

    await archive.finalize()
    await completed
    return { fileCount: files.length, projectId: project.id }
  }
}

const exportService = new ExportService()

module.exports = { ExportService, exportService, exportable }
