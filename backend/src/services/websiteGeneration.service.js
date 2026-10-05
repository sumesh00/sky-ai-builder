const { WEBSITE_GENERATION_SCHEMA } = require('../generation/websiteGenerationSchema')
const {
  WEBSITE_GENERATION_INSTRUCTIONS,
} = require('../generation/websiteGenerationPrompt')
const {
  validateWebsiteGeneration,
} = require('../generation/websiteGenerationValidator')
const { createAIProvider } = require('../providers/providerFactory')

function buildGenerationInput({ name, approvedPlan }) {
  return JSON.stringify({
    approvedPlan: approvedPlan.plan,
    originalRequest: approvedPlan.request,
    project: {
      name,
      type: approvedPlan.plan.projectType,
    },
  })
}

class WebsiteGenerationService {
  constructor({ providerFactory = createAIProvider } = {}) {
    this.providerFactory = providerFactory
  }

  async generate({ name, approvedPlan }) {
    const result = await this.providerFactory().generateStructured({
      input: buildGenerationInput({ name, approvedPlan }),
      instructions: WEBSITE_GENERATION_INSTRUCTIONS,
      name: 'website_files',
      schema: WEBSITE_GENERATION_SCHEMA,
    })
    const generated = validateWebsiteGeneration(result.value)

    return {
      ...generated,
      model: result.model,
      provider: result.provider,
      responseId: result.responseId,
    }
  }
}

module.exports = { WebsiteGenerationService, buildGenerationInput }
