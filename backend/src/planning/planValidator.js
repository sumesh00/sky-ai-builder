const AppError = require('../utils/AppError')
const { validateBackendGeneration } = require('../projects/backendGeneration')
const { validateAuthentication, validateDataGeneration } = require('../projects/dataGeneration')

const PROJECT_TYPES = new Set(['frontend', 'backend', 'full-stack', 'unknown'])
const ROOT_KEYS = new Set([
  'assumptions',
  'authentication',
  'backendGeneration',
  'databaseGeneration',
  'projectType',
  'questions',
  'requirements',
  'steps',
  'summary',
  'technology',
])

function invalidPlan() {
  throw new AppError(
    'The AI provider returned a plan that does not match the required structure',
    502,
    'AI_PLAN_INVALID',
  )
}

function isNonEmptyString(value) {
  return typeof value === 'string' && Boolean(value.trim())
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(isNonEmptyString)
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.has(key))
}

function optionalValue(value) {
  return value === null || value === undefined ? undefined : value
}

function validateDevelopmentPlan(plan) {
  if (
    !plan ||
    typeof plan !== 'object' ||
    Array.isArray(plan) ||
    !hasOnlyKeys(plan, ROOT_KEYS) ||
    !isNonEmptyString(plan.summary) ||
    !PROJECT_TYPES.has(plan.projectType) ||
    !isStringArray(plan.requirements) ||
    plan.requirements.length === 0 ||
    !isStringArray(plan.assumptions) ||
    !isStringArray(plan.questions)
  ) {
    invalidPlan()
  }

  const technology = plan.technology

  if (
    !technology ||
    typeof technology !== 'object' ||
    Array.isArray(technology) ||
    !hasOnlyKeys(technology, new Set(['frontend', 'backend', 'database'])) ||
    !isStringArray(technology.frontend) ||
    !isStringArray(technology.backend) ||
    !isStringArray(technology.database)
  ) {
    invalidPlan()
  }

  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    invalidPlan()
  }

  const dataGeneration = validateDataGeneration(optionalValue(plan.databaseGeneration))
  const authentication = validateAuthentication(optionalValue(plan.authentication), dataGeneration)
  const backendGeneration = optionalValue(plan.backendGeneration)
  validateBackendGeneration(backendGeneration)
  if ((backendGeneration || dataGeneration || authentication) && plan.projectType !== 'full-stack') {
    invalidPlan()
  }
  if (authentication && !dataGeneration) invalidPlan()
  if ((dataGeneration || authentication) && backendGeneration?.provider === 'strapi') invalidPlan()

  const stepIds = new Set()

  for (const step of plan.steps) {
    if (
      !step ||
      typeof step !== 'object' ||
      Array.isArray(step) ||
      !hasOnlyKeys(
        step,
        new Set(['id', 'title', 'description', 'status']),
      ) ||
      !isNonEmptyString(step.id) ||
      !isNonEmptyString(step.title) ||
      !isNonEmptyString(step.description) ||
      step.status !== 'pending' ||
      stepIds.has(step.id)
    ) {
      invalidPlan()
    }

    stepIds.add(step.id)
  }

  return plan
}

module.exports = { validateDevelopmentPlan }
