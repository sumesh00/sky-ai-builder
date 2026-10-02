const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_TIMEOUT_MS = 60000

function parseTimeout(value) {
  const timeout = Number.parseInt(value, 10)

  return Number.isFinite(timeout) && timeout > 0
    ? timeout
    : DEFAULT_TIMEOUT_MS
}

function getAIConfig() {
  return {
    provider: (process.env.AI_PROVIDER || 'openai').trim().toLowerCase(),
    timeoutMs: parseTimeout(process.env.AI_REQUEST_TIMEOUT_MS),
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY?.trim() || '',
        baseUrl: (
          process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL
        ).replace(/\/$/, ''),
        model: process.env.OPENAI_MODEL?.trim() || '',
      },
    },
  }
}

module.exports = { getAIConfig }
