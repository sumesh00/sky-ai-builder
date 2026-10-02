const express = require('express')
const { ProjectService } = require('../services/project.service')
const { commandService } = require('../services/command.service')
const { editService } = require('../services/edit.service')
const { previewService } = require('../services/preview.service')
const { responsiveAuditService } = require('../services/responsiveAudit.service')
const { referenceImageService } = require('../services/referenceImage.service')
const { visualCheckService } = require('../services/visualCheck.service')
const { versionService } = require('../services/version.service')
const { exportService } = require('../services/export.service')
const AppError = require('../utils/AppError')

const router = express.Router()

router.get('/', async (request, response) => {
  const projects = await new ProjectService().listProjects()

  response.json({ success: true, data: projects })
})

router.get('/:projectId', async (request, response) => {
  const project = await new ProjectService().getProject(request.params.projectId)

  response.json({ success: true, data: project })
})

router.get('/:projectId/export', async (request, response) => {
  const project = await new ProjectService().getProject(request.params.projectId)
  response.set({
    'Content-Disposition': `attachment; filename="${project.id}.zip"`,
    'Content-Type': 'application/zip',
    'X-Content-Type-Options': 'nosniff',
  })
  await exportService.streamProject(project.id, response)
})

router.get('/:projectId/reference-images', async (request, response) => {
  const references = await referenceImageService.listReferences(
    request.params.projectId,
  )

  response.json({ success: true, data: references })
})

router.get(
  '/:projectId/reference-images/:referenceId',
  async (request, response) => {
    const asset = await referenceImageService.getReferenceAsset(
      request.params.projectId,
      request.params.referenceId,
    )

    response.set({
      'Cache-Control': 'private, max-age=3600',
      'Content-Type': asset.reference.mediaType,
      'X-Content-Type-Options': 'nosniff',
    })
    response.send(asset.content)
  },
)

router.post(
  '/:projectId/reference-images',
  express.raw({
    limit: '5mb',
    type: ['image/jpeg', 'image/png', 'image/webp'],
  }),
  async (request, response) => {
    const reference = await referenceImageService.uploadReference(
      request.params.projectId,
      request.body,
      {
        contentType: request.headers['content-type'],
        fileName: request.headers['x-reference-name'],
      },
    )

    response.status(201).json({ success: true, data: reference })
  },
)

router.get('/:projectId/commands', async (request, response) => {
  const capabilities = await commandService.getCapabilities(
    request.params.projectId,
  )

  response.json({ success: true, data: capabilities })
})

router.post('/:projectId/edits', async (request, response) => {
  const result = await editService.editProject(
    request.params.projectId,
    request.body?.request,
  )

  response.json({ success: true, data: result })
})

router.post('/:projectId/responsive-audit', async (request, response) => {
  const audit = await responsiveAuditService.auditProject(request.params.projectId)

  response.json({ success: true, data: audit })
})

router.get('/:projectId/visual-checks', async (request, response) => {
  const checks = await visualCheckService.getChecks(request.params.projectId)
  response.json({ success: true, data: checks })
})

router.post('/:projectId/visual-checks', async (request, response) => {
  const check = await visualCheckService.run(request.params.projectId)
  response.status(201).json({ success: true, data: check })
})

router.get('/:projectId/versions', async (request, response) => {
  const versions = await versionService.list(request.params.projectId)
  response.json({ success: true, data: versions })
})

router.get('/:projectId/versions/:revision/diff', async (request, response) => {
  const diff = await versionService.diff(request.params.projectId, request.params.revision)
  response.json({ success: true, data: diff })
})

router.post('/:projectId/versions', async (request, response) => {
  const snapshot = await versionService.snapshot(request.params.projectId, request.body?.message)
  response.status(snapshot.created ? 201 : 200).json({ success: true, data: snapshot })
})

router.post('/:projectId/versions/:revision/restore', async (request, response) => {
  if (request.body?.confirmed !== true) {
    throw new AppError('Restoring a version requires explicit confirmation', 400, 'GIT_RESTORE_CONFIRMATION_REQUIRED')
  }
  const result = await versionService.restore(request.params.projectId, request.params.revision)
  response.json({ success: true, data: result })
})

router.post('/:projectId/commands', async (request, response) => {
  if (request.body?.confirmed !== true) {
    throw new AppError(
      'Project commands require explicit confirmation',
      400,
      'COMMAND_CONFIRMATION_REQUIRED',
    )
  }

  const result = await commandService.run(
    request.params.projectId,
    request.body?.action,
  )

  response.json({ success: true, data: result })
})

router.get('/:projectId/preview', async (request, response) => {
  const preview = await previewService.getStatus(request.params.projectId)

  response.json({ success: true, data: preview })
})

router.post('/:projectId/preview/start', async (request, response) => {
  if (request.body?.confirmed !== true) {
    throw new AppError(
      'Starting a project preview requires explicit confirmation',
      400,
      'PREVIEW_CONFIRMATION_REQUIRED',
    )
  }

  const preview = await previewService.start(request.params.projectId)

  response.json({ success: true, data: preview })
})

router.post('/:projectId/preview/stop', async (request, response) => {
  const preview = await previewService.stop(request.params.projectId)

  response.json({ success: true, data: preview })
})

router.post('/', async (request, response) => {
  const { name, planId, planVersion } = request.body || {}
  const project = await new ProjectService().createProject({
    name,
    planId,
    planVersion,
  })

  response.status(201).json({ success: true, data: project })
})

module.exports = router
