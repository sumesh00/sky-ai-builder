const express = require('express')
const {
  generateAIResponse,
  getAIStatus,
} = require('../services/ai.service')
const { createDevelopmentPlan } = require('../services/planning.service')
const AppError = require('../utils/AppError')
const { planStore } = require('../planning/planStore')

const router = express.Router()
const MAX_MESSAGE_LENGTH = 2000

router.get('/status', (request, response) => {
  response.json({
    success: true,
    data: getAIStatus(),
  })
})

router.post('/message', async (request, response) => {
  const message = request.body?.message

  if (typeof message !== 'string' || !message.trim()) {
    throw new AppError(
      'A non-empty message is required',
      400,
      'INVALID_AI_MESSAGE',
    )
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(
      `Messages cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
      400,
      'AI_MESSAGE_TOO_LONG',
    )
  }

  const result = await generateAIResponse(message.trim())

  response.json({
    success: true,
    data: result,
  })
})

router.post('/plan', async (request, response) => {
  const projectRequest = request.body?.request
  const previousPlanId = request.body?.previousPlanId
  const previousPlanVersion = request.body?.previousPlanVersion
  const figmaUrl = request.body?.figmaUrl

  if (typeof projectRequest !== 'string' || !projectRequest.trim()) {
    throw new AppError(
      'A non-empty project request is required',
      400,
      'INVALID_PLAN_REQUEST',
    )
  }

  if (projectRequest.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(
      `Project requests cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
      400,
      'PLAN_REQUEST_TOO_LONG',
    )
  }

  const result = await createDevelopmentPlan(projectRequest.trim(), { figmaUrl })

  if (previousPlanId) {
    planStore.invalidate(previousPlanId, previousPlanVersion)
  }

  response.json({
    success: true,
    data: result,
  })
})

router.post('/plans/:planId/approve', (request, response) => {
  const approval = planStore.approve(
    request.params.planId,
    request.body?.version,
  )

  response.json({ success: true, data: approval })
})

module.exports = router
