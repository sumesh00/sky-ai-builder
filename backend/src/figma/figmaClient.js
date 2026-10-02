const AppError = require('../utils/AppError')
const { parseFigmaUrl } = require('./figmaUrl')

const FIGMA_API_URL = 'https://api.figma.com/v1'
const MAX_NODES = 500
const MAX_TEXT_EXAMPLES = 20

function visit(node, summary) {
  if (!node || typeof node !== 'object' || summary.nodeCount >= MAX_NODES) {
    return
  }

  summary.nodeCount += 1
  const type = typeof node.type === 'string' ? node.type : 'UNKNOWN'
  summary.nodeTypes[type] = (summary.nodeTypes[type] || 0) + 1

  if (type === 'FRAME' && typeof node.name === 'string') {
    summary.frames.push(node.name.slice(0, 120))
  }
  if (type === 'COMPONENT' && typeof node.name === 'string') {
    summary.components.push(node.name.slice(0, 120))
  }
  if (
    type === 'TEXT' &&
    typeof node.characters === 'string' &&
    node.characters.trim() &&
    summary.textExamples.length < MAX_TEXT_EXAMPLES
  ) {
    summary.textExamples.push(node.characters.trim().replace(/\s+/g, ' ').slice(0, 160))
  }

  for (const child of Array.isArray(node.children) ? node.children : []) {
    visit(child, summary)
  }
}

function summarizeDocument(document) {
  const summary = {
    components: [],
    frames: [],
    nodeCount: 0,
    nodeTypes: {},
    textExamples: [],
  }
  visit(document, summary)

  return {
    ...summary,
    components: [...new Set(summary.components)].slice(0, 30),
    frames: [...new Set(summary.frames)].slice(0, 30),
  }
}

class FigmaClient {
  constructor({ accessToken, fetchImplementation = fetch, timeoutMs = 15000 } = {}) {
    this.accessToken = accessToken?.trim() || ''
    this.fetch = fetchImplementation
    this.timeoutMs = timeoutMs
  }

  isConfigured() {
    return Boolean(this.accessToken)
  }

  async inspect(url) {
    if (!this.isConfigured()) {
      throw new AppError(
        'Figma access is not configured. Add FIGMA_ACCESS_TOKEN to the backend environment before using a Figma URL.',
        503,
        'FIGMA_NOT_CONFIGURED',
      )
    }

    const reference = parseFigmaUrl(url)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const endpoint = new URL(
        reference.nodeId
          ? `${FIGMA_API_URL}/files/${reference.fileKey}/nodes`
          : `${FIGMA_API_URL}/files/${reference.fileKey}`,
      )
      if (reference.nodeId) {
        endpoint.searchParams.set('ids', reference.nodeId)
      } else {
        endpoint.searchParams.set('depth', '4')
      }

      const response = await this.fetch(endpoint, {
        headers: { 'X-Figma-Token': this.accessToken },
        signal: controller.signal,
      })
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new AppError(
          body.err || 'Figma could not read this design',
          response.status === 401 || response.status === 403 ? 403 : 502,
          response.status === 401 || response.status === 403
            ? 'FIGMA_ACCESS_DENIED'
            : 'FIGMA_REQUEST_FAILED',
        )
      }

      const root = reference.nodeId ? body.nodes?.[reference.nodeId]?.document : body.document
      if (!root) {
        throw new AppError('The requested Figma design node was not found', 404, 'FIGMA_NODE_NOT_FOUND')
      }

      return {
        ...reference,
        designName: typeof body.name === 'string' ? body.name.slice(0, 160) : 'Untitled Figma design',
        summary: summarizeDocument(root),
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new AppError('The Figma request timed out', 504, 'FIGMA_REQUEST_TIMEOUT')
      }
      if (error instanceof AppError) {
        throw error
      }
      throw new AppError('Unable to reach Figma', 502, 'FIGMA_UNAVAILABLE')
    } finally {
      clearTimeout(timeout)
    }
  }
}

function createFigmaClient() {
  return new FigmaClient({ accessToken: process.env.FIGMA_ACCESS_TOKEN })
}

module.exports = { FigmaClient, createFigmaClient, summarizeDocument }
