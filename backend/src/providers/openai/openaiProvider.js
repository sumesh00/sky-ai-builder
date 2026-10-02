const AIProvider = require('../aiProvider')
const AppError = require('../../utils/AppError')

function extractOutputText(responseBody) {
  if (typeof responseBody.output_text === 'string') {
    return responseBody.output_text.trim()
  }

  if (!Array.isArray(responseBody.output)) {
    return ''
  }

  return responseBody.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .filter((text) => typeof text === 'string')
    .join('\n')
    .trim()
}

class OpenAIProvider extends AIProvider {
  constructor({ apiKey, baseUrl, fetchImplementation = fetch, model, timeoutMs }) {
    super({ id: 'openai', model })
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.fetch = fetchImplementation
    this.timeoutMs = timeoutMs
  }

  isConfigured() {
    return Boolean(this.apiKey && this.baseUrl && this.model)
  }

  async createResponse({ input, instructions, text }) {
    if (!this.isConfigured()) {
      throw new AppError(
        'The OpenAI provider is not configured',
        503,
        'AI_NOT_CONFIGURED',
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const requestBody = {
        input,
        model: this.model,
        store: false,
      }

      if (instructions) {
        requestBody.instructions = instructions
      }

      if (text) {
        requestBody.text = text
      }

      const response = await this.fetch(`${this.baseUrl}/responses`, {
        body: JSON.stringify(requestBody),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      })

      const responseBody = await response.json().catch(() => ({}))

      if (!response.ok) {
        const providerMessage = responseBody.error?.message

        throw new AppError(
          providerMessage || 'The AI provider rejected the request',
          502,
          'AI_PROVIDER_REQUEST_FAILED',
        )
      }

      const outputText = extractOutputText(responseBody)

      if (!outputText) {
        throw new AppError(
          'The AI provider returned no text',
          502,
          'AI_PROVIDER_EMPTY_RESPONSE',
        )
      }

      return {
        model: responseBody.model || this.model,
        outputText,
        provider: this.id,
        responseId: responseBody.id || null,
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new AppError(
          'The AI provider request timed out',
          504,
          'AI_PROVIDER_TIMEOUT',
        )
      }

      if (error instanceof AppError) {
        throw error
      }

      throw new AppError(
        'Unable to reach the AI provider',
        502,
        'AI_PROVIDER_UNAVAILABLE',
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  async generateText({ input, instructions }) {
    const result = await this.createResponse({ input, instructions })

    return {
      message: result.outputText,
      model: result.model,
      provider: result.provider,
      responseId: result.responseId,
    }
  }

  async generateStructured({ input, instructions, name, schema }) {
    const result = await this.createResponse({
      input,
      instructions,
      text: {
        format: {
          name,
          schema,
          strict: true,
          type: 'json_schema',
        },
      },
    })

    let value

    try {
      value = JSON.parse(result.outputText)
    } catch {
      throw new AppError(
        'The AI provider returned invalid structured data',
        502,
        'AI_PROVIDER_INVALID_JSON',
      )
    }

    return {
      model: result.model,
      provider: result.provider,
      responseId: result.responseId,
      value,
    }
  }
}

module.exports = OpenAIProvider
