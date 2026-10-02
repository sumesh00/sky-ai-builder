const express = require('express')
const {
  createProjectWorkspaceService,
  createWorkspaceService,
} = require('../services/workspace.service')
const { ProjectService } = require('../services/project.service')

const router = express.Router()

router.get('/status', async (request, response) => {
  const status = await createWorkspaceService().getStatus()

  response.json({ success: true, data: status })
})

router.post('/tools/list-files', async (request, response) => {
  const { depth, path = '.', projectId } = request.body || {}
  const workspace = await createProjectWorkspaceService(projectId)
  const result = await workspace.listFiles(path, { depth })

  response.json({ success: true, data: result })
})

router.post('/tools/read-file', async (request, response) => {
  const workspace = await createProjectWorkspaceService(request.body?.projectId)
  const result = await workspace.readFile(request.body?.path)

  response.json({ success: true, data: result })
})

router.post('/tools/write-file', async (request, response) => {
  const { content, overwrite = false, path, projectId } = request.body || {}
  const workspace = await createProjectWorkspaceService(projectId)
  const result = await workspace.writeFile(path, content, {
    overwrite: overwrite === true,
  })

  await new ProjectService().touchProject(projectId)

  response.status(result.created ? 201 : 200).json({
    success: true,
    data: result,
  })
})

router.post('/tools/edit-file', async (request, response) => {
  const {
    path,
    projectId,
    replaceAll = false,
    replacement,
    search,
  } = request.body || {}
  const workspace = await createProjectWorkspaceService(projectId)
  const result = await workspace.editFile(
    path,
    search,
    replacement,
    { replaceAll: replaceAll === true },
  )

  await new ProjectService().touchProject(projectId)

  response.json({ success: true, data: result })
})

router.post('/tools/search-code', async (request, response) => {
  const {
    caseSensitive = false,
    maxResults,
    path = '.',
    projectId,
    query,
  } = request.body || {}
  const workspace = await createProjectWorkspaceService(projectId)
  const result = await workspace.searchCode(query, path, {
    caseSensitive: caseSensitive === true,
    maxResults,
  })

  response.json({ success: true, data: result })
})

module.exports = router
