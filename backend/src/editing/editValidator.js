const AppError = require('../utils/AppError')

const PROTECTED_SEGMENTS = new Set([
  '.ai-builder',
  '.git',
  'build',
  'dist',
  'node_modules',
])
const MAX_OPERATIONS = 12
const MAX_SELECTION_PATHS = 12
const MAX_SEARCH_TERMS = 8

function invalidSelection() {
  throw new AppError(
    'The AI provider returned an invalid file selection',
    502,
    'AI_EDIT_SELECTION_INVALID',
  )
}

function invalidOperations(message = 'The AI provider returned invalid edit operations') {
  throw new AppError(message, 502, 'AI_EDIT_OPERATIONS_INVALID')
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && Boolean(value.trim())
}

function validateEditPath(value) {
  if (
    !isNonEmptyString(value) ||
    value.length > 260 ||
    value.includes('\0') ||
    value.includes('\\') ||
    value.startsWith('/') ||
    /^[A-Za-z]:/.test(value)
  ) {
    invalidOperations()
  }

  const segments = value.split('/')

  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        PROTECTED_SEGMENTS.has(segment.toLocaleLowerCase()) ||
        /[<>:"|?*]/.test(segment) ||
        /[. ]$/.test(segment),
    ) ||
    segments.some((segment) => /[\u0000-\u001F\u007F]/.test(segment))
  ) {
    invalidOperations()
  }

  return value
}

function isDesignSourceFile(path) {
  return /^frontend\/src\/.+\.(?:css|jsx?)$/.test(path)
}

function validateFileSelection(selection, manifestPaths) {
  if (
    !isPlainObject(selection) ||
    Object.keys(selection).some(
      (key) => !['paths', 'rationale', 'searchTerms'].includes(key),
    ) ||
    !Array.isArray(selection.paths) ||
    selection.paths.length > MAX_SELECTION_PATHS ||
    !Array.isArray(selection.searchTerms) ||
    selection.searchTerms.length > MAX_SEARCH_TERMS ||
    typeof selection.rationale !== 'string'
  ) {
    invalidSelection()
  }

  const paths = []
  const seenPaths = new Set()

  for (const path of selection.paths) {
    if (
      !isNonEmptyString(path) ||
      !manifestPaths.has(path) ||
      seenPaths.has(path)
    ) {
      invalidSelection()
    }

    seenPaths.add(path)
    paths.push(path)
  }

  const searchTerms = []
  const seenTerms = new Set()

  for (const term of selection.searchTerms) {
    const trimmedTerm = typeof term === 'string' ? term.trim() : ''

    if (
      !trimmedTerm ||
      trimmedTerm.length > 200 ||
      seenTerms.has(trimmedTerm)
    ) {
      invalidSelection()
    }

    seenTerms.add(trimmedTerm)
    searchTerms.push(trimmedTerm)
  }

  return { paths, rationale: selection.rationale.trim(), searchTerms }
}

function validateEditOperations(
  result,
  inspectedPaths,
  manifestPaths,
  knownPaths = manifestPaths,
  { designSourceOnly = false } = {},
) {
  if (
    !isPlainObject(result) ||
    Object.keys(result).some((key) => !['operations', 'summary'].includes(key)) ||
    !isNonEmptyString(result.summary) ||
    !Array.isArray(result.operations) ||
    result.operations.length === 0 ||
    result.operations.length > MAX_OPERATIONS
  ) {
    invalidOperations()
  }

  const createdPaths = new Set()
  const allowedKeys = new Set([
    'content',
    'path',
    'replaceAll',
    'replacement',
    'search',
    'type',
  ])

  const operations = result.operations.map((operation) => {
    if (
      !isPlainObject(operation) ||
      Object.keys(operation).some((key) => !allowedKeys.has(key)) ||
      !['create', 'replace'].includes(operation.type) ||
      typeof operation.content !== 'string' ||
      typeof operation.search !== 'string' ||
      typeof operation.replacement !== 'string' ||
      typeof operation.replaceAll !== 'boolean'
    ) {
      invalidOperations()
    }

    const path = validateEditPath(operation.path)

    if (designSourceOnly && (operation.type !== 'replace' || !isDesignSourceFile(path))) {
      invalidOperations('Figma design edits may only replace frontend source files')
    }

    if (operation.type === 'create') {
      if (
        knownPaths.has(path) ||
        createdPaths.has(path) ||
        [...manifestPaths].some((filePath) => path.startsWith(`${filePath}/`)) ||
        operation.search ||
        operation.replacement ||
        operation.replaceAll
      ) {
        invalidOperations()
      }

      createdPaths.add(path)
    } else if (
      !inspectedPaths.has(path) ||
      !manifestPaths.has(path) ||
      !operation.search ||
      operation.content
    ) {
      invalidOperations()
    }

    return { ...operation, path }
  })

  return { operations, summary: result.summary.trim() }
}

module.exports = {
  validateEditOperations,
  validateEditPath,
  validateFileSelection,
  isDesignSourceFile,
}
