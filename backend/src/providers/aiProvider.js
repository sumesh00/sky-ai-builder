class AIProvider {
  constructor({ id, model }) {
    this.id = id
    this.model = model
  }

  isConfigured() {
    return false
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      model: this.model || null,
      provider: this.id,
    }
  }

  async generateText() {
    throw new Error('generateText() must be implemented by an AI provider')
  }

  async generateStructured() {
    throw new Error('generateStructured() must be implemented by an AI provider')
  }
}

module.exports = AIProvider
