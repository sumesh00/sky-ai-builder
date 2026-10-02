const DEVELOPMENT_PLAN_SCHEMA = {
  additionalProperties: false,
  properties: {
    assumptions: {
      items: { type: 'string' },
      type: 'array',
    },
    authentication: {
      additionalProperties: false,
      properties: {
        enabled: { const: true, type: 'boolean' },
        roles: {
          items: {
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              permissions: { items: { type: 'string' }, type: 'array' },
            },
            required: ['name', 'permissions'],
            type: 'object',
          },
          type: 'array',
        },
      },
      required: ['enabled', 'roles'],
      type: ['object', 'null'],
    },
    backendGeneration: {
      additionalProperties: false,
      properties: {
        contentTypes: {
          items: {
            additionalProperties: false,
            properties: {
              fields: {
                items: {
                  additionalProperties: false,
                  properties: {
                    name: { type: 'string' },
                    required: { type: 'boolean' },
                    type: { enum: ['string', 'text', 'richtext', 'email', 'date', 'datetime', 'boolean', 'integer', 'decimal', 'media'], type: 'string' },
                  },
                  required: ['name', 'type', 'required'],
                  type: 'object',
                },
                type: 'array',
              },
              name: { type: 'string' },
            },
            required: ['name', 'fields'],
            type: 'object',
          },
          type: 'array',
        },
        provider: { enum: ['express', 'strapi'], type: 'string' },
      },
      required: ['provider', 'contentTypes'],
      type: ['object', 'null'],
    },
    databaseGeneration: {
      additionalProperties: false,
      properties: {
        entities: {
          items: {
            additionalProperties: false,
            properties: {
              fields: {
                items: {
                  additionalProperties: false,
                  properties: {
                    name: { type: 'string' },
                    required: { type: 'boolean' },
                    type: { enum: ['string', 'text', 'email', 'password', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'uuid'], type: 'string' },
                    unique: { type: 'boolean' },
                  },
                  required: ['name', 'type', 'required', 'unique'],
                  type: 'object',
                },
                type: 'array',
              },
              name: { type: 'string' },
            },
            required: ['name', 'fields'],
            type: 'object',
          },
          type: 'array',
        },
        provider: { enum: ['sqlite', 'postgresql', 'mysql'], type: 'string' },
        relationships: {
          items: {
            additionalProperties: false,
            properties: {
              source: { type: 'string' },
              target: { type: 'string' },
              type: { enum: ['one-to-one', 'many-to-one', 'many-to-many'], type: 'string' },
            },
            required: ['source', 'target', 'type'],
            type: 'object',
          },
          type: 'array',
        },
      },
      required: ['provider', 'entities', 'relationships'],
      type: ['object', 'null'],
    },
    projectType: {
      enum: ['frontend', 'backend', 'full-stack', 'unknown'],
      type: 'string',
    },
    questions: {
      items: { type: 'string' },
      type: 'array',
    },
    requirements: {
      items: { type: 'string' },
      type: 'array',
    },
    steps: {
      items: {
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          id: { type: 'string' },
          status: { enum: ['pending'], type: 'string' },
          title: { type: 'string' },
        },
        required: ['id', 'title', 'description', 'status'],
        type: 'object',
      },
      type: 'array',
    },
    summary: { type: 'string' },
    technology: {
      additionalProperties: false,
      properties: {
        backend: {
          items: { type: 'string' },
          type: 'array',
        },
        database: {
          items: { type: 'string' },
          type: 'array',
        },
        frontend: {
          items: { type: 'string' },
          type: 'array',
        },
      },
      required: ['frontend', 'backend', 'database'],
      type: 'object',
    },
  },
  required: [
    'summary',
    'projectType',
    'requirements',
    'technology',
    'steps',
    'assumptions',
    'questions',
    'authentication',
    'backendGeneration',
    'databaseGeneration',
  ],
  type: 'object',
}

module.exports = { DEVELOPMENT_PLAN_SCHEMA }
