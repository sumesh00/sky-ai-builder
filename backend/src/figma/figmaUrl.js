const AppError = require('../utils/AppError')

const FIGMA_HOSTS = new Set(['figma.com', 'www.figma.com'])
const FILE_PATH_TYPES = new Set(['design', 'file'])

function invalidFigmaUrl() {
  throw new AppError(
    'Provide a valid Figma design or file URL',
    400,
    'FIGMA_URL_INVALID',
  )
}

function parseFigmaUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) {
    invalidFigmaUrl()
  }

  let url
  try {
    url = new URL(value.trim())
  } catch {
    invalidFigmaUrl()
  }

  if (url.protocol !== 'https:' || !FIGMA_HOSTS.has(url.hostname.toLowerCase())) {
    invalidFigmaUrl()
  }

  const segments = url.pathname.split('/').filter(Boolean)
  if (!FILE_PATH_TYPES.has(segments[0]) || !/^[A-Za-z0-9]{10,128}$/.test(segments[1] || '')) {
    invalidFigmaUrl()
  }

  const nodeId = url.searchParams.get('node-id') || undefined
  if (nodeId && !/^[0-9]+:[0-9]+$/.test(nodeId)) {
    invalidFigmaUrl()
  }

  return {
    fileKey: segments[1],
    nodeId,
    url: url.toString(),
  }
}

module.exports = { parseFigmaUrl }
