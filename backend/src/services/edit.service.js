const { randomUUID } = require('node:crypto')
const {
  EDIT_FILE_SELECTION_SCHEMA,
  EDIT_OPERATIONS_SCHEMA,
} = require('../editing/editSchemas')
const {
  EDIT_GENERATION_INSTRUCTIONS,
  FILE_SELECTION_INSTRUCTIONS,
} = require('../editing/editPrompts')
const {
  validateEditOperations,
  validateFileSelection,
} = require('../editing/editValidator')
const {
  projectProcessRegistry,
} = require('../processes/projectProcessRegistry')
const { createAIProvider } = require('../providers/providerFactory')
const AppError = require('../utils/AppError')
const { ProjectService } = require('./project.service')
const { createProjectWorkspaceService } = require('./workspace.service')
const { versionService } = require('./version.service')

const MAX_CONTEXT_BYTES = 120 * 1024
const MAX_CONTEXT_FILES = 12
const MAX_FILE_BYTES = 1024 * 1024
const MAX_REQUEST_LENGTH = 2000

function validateRequest(request) {
  if (typeof request !== 'string' || !request.trim()) {
    throw new AppError(
      'A non-empty project edit request is required',
      400,
      'INVALID_EDIT_REQUEST',
    )
  }

  if (request.length > MAX_REQUEST_LENGTH) {
    throw new AppError(
      `Project edit requests cannot exceed ${MAX_REQUEST_LENGTH} characters`,
      400,
      'EDIT_REQUEST_TOO_LONG',
    )
  }

  return request.trim()
}

function buildSelectionInput(request, project, manifest) {
  return JSON.stringify({
    project: { id: project.id, name: project.name, type: project.type },
    projectManifest: manifest,
    userRequest: request,
  })
}

function buildEditInput(request, project, files) {
  return JSON.stringify({
    project: { id: project.id, name: project.name, type: project.type },
    projectContext: files.map((file) => ({
      content: file.content,
      path: file.path,
    })),
    userRequest: request,
  })
}

function validateGeneratedContent(content) {
  if (
    Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(content)
  ) {
    throw new AppError(
      'The AI provider returned unsafe or oversized file content',
      502,
      'AI_EDIT_CONTENT_INVALID',
    )
  }

  return content
}

function simulateOperations(operations, fileContents) {
  const workingContents = new Map(fileContents)
  const changes = new Map()

  for (const operation of operations) {
    if (operation.type === 'create') {
      const change = {
        action: 'created',
        content: validateGeneratedContent(operation.content),
        path: operation.path,
        replacements: 0,
      }
      workingContents.set(operation.path, change.content)
      changes.set(operation.path, change)
      continue
    }

    const currentContent = workingContents.get(operation.path)
    const occurrences = currentContent.split(operation.search).length - 1

    if (occurrences === 0) {
      throw new AppError(
        `The proposed search text was not found in ${operation.path}`,
        409,
        'AI_EDIT_SEARCH_NOT_FOUND',
      )
    }

    const content = operation.replaceAll
      ? currentContent.split(operation.search).join(operation.replacement)
      : currentContent.replace(operation.search, operation.replacement)

    const previousChange = changes.get(operation.path)
    const change = {
      action: 'updated',
      content: validateGeneratedContent(content),
      path: operation.path,
      replacements:
        (previousChange?.replacements || 0) +
        (operation.replaceAll ? occurrences : 1),
    }
    workingContents.set(operation.path, change.content)
    changes.set(operation.path, change)
  }

  return [...changes.values()]
}

async function assertProjectUnchanged(workspace, changes, originalContents) {
  const currentListing = await workspace.listFiles('.', { depth: 10 })
  const currentEntries = new Map(
    currentListing.entries.map((entry) => [entry.path, entry.type]),
  )
  const currentFiles = new Set(
    currentListing.entries
      .filter((entry) => entry.type === 'file')
      .map((entry) => entry.path),
  )

  for (const change of changes) {
    if (change.action === 'created') {
      const parentIsFile = [...currentFiles].some((filePath) =>
        change.path.startsWith(`${filePath}/`),
      )

      if (currentEntries.has(change.path) || parentIsFile) {
        throw new AppError(
          `The project changed while ${change.path} was being prepared`,
          409,
          'PROJECT_CHANGED_DURING_EDIT',
        )
      }

      continue
    }

    try {
      const currentFile = await workspace.readFile(change.path)

      if (currentFile.content !== originalContents.get(change.path)) {
        throw new AppError(
          `The project changed while ${change.path} was being prepared`,
          409,
          'PROJECT_CHANGED_DURING_EDIT',
        )
      }
    } catch (error) {
      if (error.code === 'PROJECT_CHANGED_DURING_EDIT') {
        throw error
      }

      throw new AppError(
        `The project changed while ${change.path} was being prepared`,
        409,
        'PROJECT_CHANGED_DURING_EDIT',
      )
    }
  }
}

class EditService {
  constructor({
    processRegistry = projectProcessRegistry,
    projectService = new ProjectService(),
    providerFactory = createAIProvider,
    workspaceFactory = createProjectWorkspaceService,
  } = {}) {
    this.processRegistry = processRegistry
    this.projectService = projectService
    this.providerFactory = providerFactory
    this.workspaceFactory = workspaceFactory
  }

  async editProject(projectId, rawRequest) {
    const request = validateRequest(rawRequest)
    const project = await this.projectService.getProject(projectId)
    const editId = randomUUID()

    if (
      !this.processRegistry.tryAcquire(project.id, {
        id: editId,
        kind: 'edit',
        startedAt: new Date().toISOString(),
      })
    ) {
      throw new AppError(
        'Another project operation is already active',
        409,
        'PROJECT_EDIT_BLOCKED',
      )
    }

    try {
      const workspace = await this.workspaceFactory(project.id)
      const listing = await workspace.listFiles('.', { depth: 10 })
      const manifest = listing.entries
        .filter((entry) => entry.type === 'file')
        .map((entry) => ({ path: entry.path, size: entry.size }))
      const manifestPaths = new Set(manifest.map((entry) => entry.path))
      const knownPaths = new Set(listing.entries.map((entry) => entry.path))
      const provider = this.providerFactory()
      const selectionResult = await provider.generateStructured({
        input: buildSelectionInput(request, project, manifest),
        instructions: FILE_SELECTION_INSTRUCTIONS,
        name: 'project_edit_file_selection',
        schema: EDIT_FILE_SELECTION_SCHEMA,
      })
      const selection = validateFileSelection(
        selectionResult.value,
        manifestPaths,
      )
      const relevantPaths = [...selection.paths]
      const relevantPathSet = new Set(relevantPaths)

      for (const searchTerm of selection.searchTerms) {
        const search = await workspace.searchCode(searchTerm, '.', {
          maxResults: 20,
        })

        for (const result of search.results) {
          if (
            relevantPaths.length < MAX_CONTEXT_FILES &&
            manifestPaths.has(result.path) &&
            !relevantPathSet.has(result.path)
          ) {
            relevantPathSet.add(result.path)
            relevantPaths.push(result.path)
          }
        }
      }

      const files = []
      let contextBytes = 0

      for (const path of relevantPaths.slice(0, MAX_CONTEXT_FILES)) {
        const file = await workspace.readFile(path)

        if (contextBytes + file.size > MAX_CONTEXT_BYTES) {
          continue
        }

        contextBytes += file.size
        files.push(file)
      }

      const inspectedPaths = new Set(files.map((file) => file.path))
      const editResult = await provider.generateStructured({
        input: buildEditInput(request, project, files),
        instructions: EDIT_GENERATION_INSTRUCTIONS,
        name: 'project_edit_operations',
        schema: EDIT_OPERATIONS_SCHEMA,
      })
      const proposedEdit = validateEditOperations(
        editResult.value,
        inspectedPaths,
        manifestPaths,
        knownPaths,
      )
      const fileContents = new Map(files.map((file) => [file.path, file.content]))
      const simulatedChanges = simulateOperations(
        proposedEdit.operations,
        fileContents,
      )
      const changes = []

      await assertProjectUnchanged(workspace, simulatedChanges, fileContents)

      for (const change of simulatedChanges) {
        const result = await workspace.writeFile(change.path, change.content, {
          overwrite: change.action === 'updated',
        })

        changes.push({
          action: change.action,
          path: result.path,
          replacements: change.replacements,
          size: result.size,
        })
      }

      await this.projectService.touchProject(project.id)
      try {
        await versionService.snapshot(project.id, 'AI edit')
      } catch {
        // Older projects can predate Phase 16 versioning; their edits remain valid.
      }

      return {
        changes,
        editId,
        inspectedFiles: files.map((file) => file.path),
        model: editResult.model,
        projectId: project.id,
        provider: editResult.provider,
        responseIds: [selectionResult.responseId, editResult.responseId].filter(
          Boolean,
        ),
        summary: proposedEdit.summary,
        validation: 'not_run',
      }
    } finally {
      this.processRegistry.release(project.id, editId)
    }
  }
}

const editService = new EditService()

module.exports = { EditService, editService, validateRequest }
