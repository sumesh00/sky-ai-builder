const { createAIProvider } = require('../providers/providerFactory')

function getAIStatus() {
  return createAIProvider().getStatus()
}

async function generateAIResponse(message) {
  const provider = createAIProvider()

  return provider.generateText({ input: message })
}

module.exports = { generateAIResponse, getAIStatus }
