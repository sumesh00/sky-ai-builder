const path = require('node:path')
const AppError = require('../utils/AppError')

const PROJECT_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/
const RESERVED_NAMES = new Set([
  'aux',
  'clock$',
  'con',
  'nul',
  'prn',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
])

function invalidProjectName() {
  throw new AppError(
    'Project names must contain 2 to 80 safe characters and cannot contain paths',
    400,
    'PROJECT_NAME_INVALID',
  )
}

function createProjectId(name) {
  if (typeof name !== 'string') {
    invalidProjectName()
  }

  const trimmedName = name.trim()

  if (
    trimmedName.length < 2 ||
    trimmedName.length > 80 ||
    trimmedName.includes('\0') ||
    trimmedName.includes('/') ||
    trimmedName.includes('\\') ||
    trimmedName === '.' ||
    trimmedName === '..' ||
    path.isAbsolute(trimmedName)
  ) {
    invalidProjectName()
  }

  const projectId = trimmedName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')

  if (
    !PROJECT_ID_PATTERN.test(projectId) ||
    RESERVED_NAMES.has(projectId)
  ) {
    invalidProjectName()
  }

  return { name: trimmedName, projectId }
}

function validateProjectId(projectId) {
  if (
    typeof projectId !== 'string' ||
    !PROJECT_ID_PATTERN.test(projectId) ||
    RESERVED_NAMES.has(projectId)
  ) {
    throw new AppError(
      'The project ID is invalid',
      400,
      'PROJECT_ID_INVALID',
    )
  }

  return projectId
}

module.exports = { createProjectId, validateProjectId }
