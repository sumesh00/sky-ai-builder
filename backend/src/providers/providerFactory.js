const { getAIConfig } = require('../config/ai')
const AppError = require('../utils/AppError')
const OpenAIProvider = require('./openai/openaiProvider')

function createAIProvider() {
  const config = getAIConfig()

  if (config.provider === 'openai') {
    return new OpenAIProvider({
      ...config.providers.openai,
      timeoutMs: config.timeoutMs,
    })
  }

  throw new AppError(
    `Unsupported AI provider: ${config.provider}`,
    500,
    'AI_PROVIDER_UNSUPPORTED',
  )
}

module.exports = { createAIProvider }
