const AppError = require('../utils/AppError')

const GENERATED_PATHS = Object.freeze([
  'frontend/src/App.jsx',
  'frontend/src/index.css',
])
const GENERATED_PATH_SET = new Set(GENERATED_PATHS)
const MAX_GENERATED_FILE_BYTES = 512 * 1024
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/
const UNSAFE_SOURCE_PATTERNS = [
  /dangerouslySetInnerHTML/,
  /<script\b/i,
  /javascript\s*:/i,
]

function invalidGeneration(message = 'The AI provider returned invalid website files') {
  throw new AppError(message, 502, 'AI_WEBSITE_GENERATION_INVALID')
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateContent(path, content) {
  if (
    typeof content !== 'string' ||
    !content.trim() ||
    Buffer.byteLength(content, 'utf8') > MAX_GENERATED_FILE_BYTES ||
    CONTROL_CHARACTERS.test(content) ||
    content.includes('```') ||
    UNSAFE_SOURCE_PATTERNS.some((pattern) => pattern.test(content))
  ) {
    invalidGeneration(`The AI provider returned invalid content for ${path}`)
  }

  if (path.endsWith('.css')) {
    if (/@import\b/i.test(content) || /@tailwind\b/i.test(content)) {
      invalidGeneration('Generated CSS cannot import external dependencies')
    }

    return content
  }

  if (!/\bexport\s+default\b/.test(content)) {
    invalidGeneration('Generated App.jsx must have a default export')
  }

  const importLines = content
    .split(/\r?\n/)
    .filter((line) => /^\s*import\b/.test(line))
  const reactImport =
    /^\s*import\s+(?:(?:[A-Za-z0-9_$*{},\s]+)\s+from\s+)?['"]react['"]\s*;?\s*$/

  if (importLines.some((line) => !reactImport.test(line))) {
    invalidGeneration('Generated App.jsx cannot import dependencies other than React')
  }

  if (
    /^\s*export\b[^\r\n]*\bfrom\s*['"]/m.test(content) ||
    /\brequire\s*\(/.test(content) ||
    /\bimport\s*\(/.test(content)
  ) {
    invalidGeneration('Generated App.jsx cannot load dynamic dependencies')
  }

  return content
}

function validateWebsiteGeneration(result) {
  if (
    !isPlainObject(result) ||
    Object.keys(result).some((key) => !['files', 'summary'].includes(key)) ||
    typeof result.summary !== 'string' ||
    !result.summary.trim() ||
    !Array.isArray(result.files) ||
    result.files.length !== GENERATED_PATHS.length
  ) {
    invalidGeneration()
  }

  const files = new Map()

  for (const file of result.files) {
    if (
      !isPlainObject(file) ||
      Object.keys(file).some((key) => !['content', 'path'].includes(key)) ||
      !GENERATED_PATH_SET.has(file.path) ||
      files.has(file.path)
    ) {
      invalidGeneration()
    }

    files.set(file.path, validateContent(file.path, file.content))
  }

  if (files.size !== GENERATED_PATHS.length) {
    invalidGeneration()
  }

  return {
    files: GENERATED_PATHS.map((path) => ({ content: files.get(path), path })),
    summary: result.summary.trim(),
  }
}

module.exports = {
  GENERATED_PATHS,
  MAX_GENERATED_FILE_BYTES,
  validateWebsiteGeneration,
}
