const { WEBSITE_GENERATION_SCHEMA } = require('../generation/websiteGenerationSchema')
const {
  FIGMA_DESIGN_IMPLEMENTATION_INSTRUCTIONS,
  WEBSITE_GENERATION_INSTRUCTIONS,
} = require('../generation/websiteGenerationPrompt')
const {
  validateWebsiteGeneration,
} = require('../generation/websiteGenerationValidator')
const { createAIProvider } = require('../providers/providerFactory')

function getDesignSpecification(approvedPlan) {
  const specification = approvedPlan?.designReference?.designSpecification

  return specification && typeof specification === 'object'
    ? specification
    : null
}

function buildGenerationInput({ name, approvedPlan }) {
  return JSON.stringify({
    approvedPlan: approvedPlan.plan,
    designSpecification: getDesignSpecification(approvedPlan),
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
    const designSpecification = getDesignSpecification(approvedPlan)
    const result = await this.providerFactory().generateStructured({
      input: buildGenerationInput({ name, approvedPlan }),
      instructions: designSpecification
        ? `${WEBSITE_GENERATION_INSTRUCTIONS}\n\n${FIGMA_DESIGN_IMPLEMENTATION_INSTRUCTIONS}`
        : WEBSITE_GENERATION_INSTRUCTIONS,
      name: 'website_files',
      schema: WEBSITE_GENERATION_SCHEMA,
    })
    const generated = validateWebsiteGeneration(result.value, {
      requireFigmaScrollBanner: Boolean(designSpecification),
    })

    return {
      ...generated,
      model: result.model,
      provider: result.provider,
      responseId: result.responseId,
    }
  }
}

module.exports = {
  WebsiteGenerationService,
  buildGenerationInput,
  getDesignSpecification,
}
