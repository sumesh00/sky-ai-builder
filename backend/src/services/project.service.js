const AppError = require('../utils/AppError')
const { planStore } = require('../planning/planStore')
const { buildProjectFiles } = require('../projects/projectTemplates')
const {
  createProjectId,
  validateProjectId,
} = require('../projects/projectValidation')
const { createWorkspaceService } = require('./workspace.service')
const { versionService } = require('./version.service')
const { WebsiteGenerationService } = require('./websiteGeneration.service')

const METADATA_DIRECTORY = '.ai-builder'
const METADATA_FILENAME = 'project.json'
const SUPPORTED_PROJECT_TYPES = new Set(['frontend', 'full-stack'])

function metadataPath(projectId) {
  return `${projectId}/${METADATA_DIRECTORY}/${METADATA_FILENAME}`
}

function parseMetadata(file) {
  try {
    const metadata = JSON.parse(file.content)

    if (
      !metadata ||
      typeof metadata.id !== 'string' ||
      typeof metadata.name !== 'string' ||
      !SUPPORTED_PROJECT_TYPES.has(metadata.type)
    ) {
      return null
    }

    return metadata
  } catch {
    return null
  }
}

class ProjectService {
  constructor({
    plans = planStore,
    websiteGeneration = new WebsiteGenerationService(),
    workspace = createWorkspaceService(),
  } = {}) {
    this.plans = plans
    this.websiteGeneration = websiteGeneration
    this.workspace = workspace
  }

  async listProjects() {
    const listing = await this.workspace.listFiles('.', { depth: 1 })
    const directories = listing.entries.filter(
      (entry) => entry.type === 'directory' && entry.path !== METADATA_DIRECTORY,
    )
    const projects = []

    for (const directory of directories) {
      try {
        const file = await this.workspace.readFile(metadataPath(directory.path))
        const metadata = parseMetadata(file)

        if (metadata) {
          projects.push(metadata)
        }
      } catch (error) {
        if (error.code !== 'WORKSPACE_PATH_NOT_FOUND') {
          throw error
        }
      }
    }

    return projects.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    )
  }

  async getProject(projectId) {
    const safeProjectId = validateProjectId(projectId)
    let file

    try {
      file = await this.workspace.readFile(metadataPath(safeProjectId))
    } catch (error) {
      if (error.code === 'WORKSPACE_PATH_NOT_FOUND') {
        throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND')
      }

      throw error
    }

    const metadata = parseMetadata(file)

    if (!metadata || metadata.id !== safeProjectId) {
      throw new AppError(
        'Project metadata is missing or invalid',
        409,
        'PROJECT_METADATA_INVALID',
      )
    }

    return metadata
  }

  async createProject({ name, planId, planVersion }) {
    const approvedPlan = this.plans.requireApproved(planId, planVersion)
    const { name: safeName, projectId } = createProjectId(name)
    const type = approvedPlan.plan.projectType

    if (!SUPPORTED_PROJECT_TYPES.has(type)) {
      throw new AppError(
        `Project generation does not yet support plan type: ${type}`,
        400,
        'PROJECT_TYPE_UNSUPPORTED',
      )
    }

    const existingProjects = await this.workspace.listFiles('.', { depth: 1 })

    if (existingProjects.entries.some((entry) => entry.path === projectId)) {
      throw new AppError(
        'A project with this name already exists',
        409,
        'PROJECT_ALREADY_EXISTS',
      )
    }

    const generatedWebsite = await this.websiteGeneration.generate({
      approvedPlan,
      name: safeName,
    })
    const timestamp = new Date().toISOString()
    const metadata = {
      createdAt: timestamp,
      id: projectId,
      name: safeName,
      originatingPlan: {
        id: approvedPlan.id,
        model: approvedPlan.model,
        provider: approvedPlan.provider,
        request: approvedPlan.request,
        responseId: approvedPlan.responseId,
        summary: approvedPlan.plan.summary,
        version: approvedPlan.version,
        designReference: approvedPlan.designReference || null,
        backendGeneration: approvedPlan.plan.backendGeneration || null,
        authentication: approvedPlan.plan.authentication || null,
        databaseGeneration: approvedPlan.plan.databaseGeneration || null,
      },
      schemaVersion: 1,
      type,
      updatedAt: timestamp,
      websiteGeneration: {
        model: generatedWebsite.model,
        provider: generatedWebsite.provider,
        responseId: generatedWebsite.responseId,
        summary: generatedWebsite.summary,
      },
    }
    const generatedFiles = new Map(
      generatedWebsite.files.map((file) => [file.path, file.content]),
    )
    const files = buildProjectFiles({
      name: safeName,
      plan: approvedPlan.plan,
      projectId,
      type,
    }).map((file) => ({
      ...file,
      content: generatedFiles.get(file.path) ?? file.content,
    }))

    for (const file of files) {
      await this.workspace.writeFile(`${projectId}/${file.path}`, file.content)
    }

    await this.workspace.writeFile(
      metadataPath(projectId),
      `${JSON.stringify(metadata, null, 2)}\n`,
    )

    try {
      metadata.versioning = await versionService.initialize(projectId)
      await this.workspace.writeFile(
        metadataPath(projectId),
        `${JSON.stringify(metadata, null, 2)}\n`,
        { overwrite: true },
      )
      await versionService.snapshot(projectId, 'Initialize versioning')
    } catch (error) {
      metadata.versioning = { provider: 'git', status: 'unavailable' }
      await this.workspace.writeFile(
        metadataPath(projectId),
        `${JSON.stringify(metadata, null, 2)}\n`,
        { overwrite: true },
      )
    }

    return {
      ...metadata,
      fileCount: files.length,
    }
  }

  async touchProject(projectId) {
    const metadata = await this.getProject(projectId)
    const updatedMetadata = {
      ...metadata,
      updatedAt: new Date().toISOString(),
    }

    await this.workspace.writeFile(
      metadataPath(projectId),
      `${JSON.stringify(updatedMetadata, null, 2)}\n`,
      { overwrite: true },
    )

    return updatedMetadata
  }
}

module.exports = { ProjectService }
