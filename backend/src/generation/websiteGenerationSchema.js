const WEBSITE_GENERATION_SCHEMA = {
  additionalProperties: false,
  properties: {
    files: {
      items: {
        additionalProperties: false,
        properties: {
          content: { type: 'string' },
          path: {
            enum: ['frontend/src/App.jsx', 'frontend/src/index.css'],
            type: 'string',
          },
        },
        required: ['path', 'content'],
        type: 'object',
      },
      maxItems: 2,
      minItems: 2,
      type: 'array',
    },
    summary: { type: 'string' },
  },
  required: ['summary', 'files'],
  type: 'object',
}

module.exports = { WEBSITE_GENERATION_SCHEMA }
