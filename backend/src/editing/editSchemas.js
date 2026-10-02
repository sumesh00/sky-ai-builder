const EDIT_FILE_SELECTION_SCHEMA = {
  additionalProperties: false,
  properties: {
    paths: {
      items: { type: 'string' },
      maxItems: 12,
      type: 'array',
    },
    rationale: { type: 'string' },
    searchTerms: {
      items: { type: 'string' },
      maxItems: 8,
      type: 'array',
    },
  },
  required: ['paths', 'searchTerms', 'rationale'],
  type: 'object',
}

const EDIT_OPERATIONS_SCHEMA = {
  additionalProperties: false,
  properties: {
    operations: {
      items: {
        additionalProperties: false,
        properties: {
          content: { type: 'string' },
          path: { type: 'string' },
          replaceAll: { type: 'boolean' },
          replacement: { type: 'string' },
          search: { type: 'string' },
          type: { enum: ['create', 'replace'], type: 'string' },
        },
        required: [
          'type',
          'path',
          'content',
          'search',
          'replacement',
          'replaceAll',
        ],
        type: 'object',
      },
      maxItems: 12,
      minItems: 1,
      type: 'array',
    },
    summary: { type: 'string' },
  },
  required: ['summary', 'operations'],
  type: 'object',
}

module.exports = { EDIT_FILE_SELECTION_SCHEMA, EDIT_OPERATIONS_SCHEMA }
