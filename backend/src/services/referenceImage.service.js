const { randomUUID } = require('node:crypto')
const { validateProjectId } = require('../projects/projectValidation')
const {
  MAX_REFERENCE_IMAGE_BYTES,
  validateReferenceImage,
} = require('../references/referenceImage')
const AppError = require('../utils/AppError')
const { ProjectService } = require('./project.service')
const { createWorkspaceService } = require('./workspace.service')

const REFERENCE_METADATA_PATH = '.ai-builder/references.json'

function referenceMetadataPath(projectId) {
  return `${validateProjectId(projectId)}/${REFERENCE_METADATA_PATH}`
}

function referenceImagePath(projectId, referenceId, extension) {
  return `${validateProjectId(projectId)}/.ai-builder/references/${referenceId}.${extension}`
}

function parseReferences(file) {
  try {
    const value = JSON.parse(file.content)

    if (!value || !Array.isArray(value.references)) {
      return null
    }

    return value.references.filter(
      (reference) =>
        reference &&
        typeof reference.id === 'string' &&
        typeof reference.mediaType === 'string' &&
        typeof reference.storagePath === 'string',
    )
  } catch {
    return null
  }
}

function publicReference(reference) {
  const { storagePath, ...publicData } = reference
  return publicData
}

class ReferenceImageService {
  constructor({
    projectService = new ProjectService(),
    workspace = createWorkspaceService(),
  } = {}) {
    this.projectService = projectService
    this.workspace = workspace
  }

  async getReferences(projectId) {
    const safeProjectId = validateProjectId(projectId)
    await this.projectService.getProject(safeProjectId)

    try {
      const file = await this.workspace.readFile(referenceMetadataPath(safeProjectId))
      const references = parseReferences(file)

      if (!references) {
        throw new AppError(
          'Project reference metadata is invalid',
          409,
          'REFERENCE_METADATA_INVALID',
        )
      }

      return references
    } catch (error) {
      if (error.code === 'WORKSPACE_PATH_NOT_FOUND') {
        return []
      }

      throw error
    }
  }

  async listReferences(projectId) {
    const references = await this.getReferences(projectId)
    return references.map(publicReference)
  }

  async uploadReference(projectId, buffer, { contentType, fileName } = {}) {
    const safeProjectId = validateProjectId(projectId)
    await this.projectService.getProject(safeProjectId)
    const image = validateReferenceImage(buffer, contentType, fileName)
    const references = await this.getReferences(safeProjectId)
    const reference = {
      createdAt: new Date().toISOString(),
      fileName: image.fileName,
      height: image.height,
      id: randomUUID(),
      mediaType: image.mediaType,
      size: image.size,
      storagePath: '',
      width: image.width,
    }

    reference.storagePath = referenceImagePath(
      safeProjectId,
      reference.id,
      image.extension,
    )

    await this.workspace.writeBinaryFile(reference.storagePath, buffer, {
      maxBytes: MAX_REFERENCE_IMAGE_BYTES,
    })

    try {
      await this.workspace.writeFile(
        referenceMetadataPath(safeProjectId),
        `${JSON.stringify({ references: [...references, reference], schemaVersion: 1 }, null, 2)}\n`,
        { overwrite: true },
      )
    } catch (error) {
      throw error
    }

    await this.projectService.touchProject(safeProjectId)
    return publicReference(reference)
  }

  async getReferenceAsset(projectId, referenceId) {
    const references = await this.getReferences(projectId)
    const reference = references.find((item) => item.id === referenceId)

    if (!reference) {
      throw new AppError('Reference image not found', 404, 'REFERENCE_IMAGE_NOT_FOUND')
    }

    const asset = await this.workspace.readBinaryFile(reference.storagePath, {
      maxBytes: MAX_REFERENCE_IMAGE_BYTES,
    })

    return { content: asset.content, reference: publicReference(reference) }
  }
}

const referenceImageService = new ReferenceImageService()

module.exports = { ReferenceImageService, referenceImageService }
