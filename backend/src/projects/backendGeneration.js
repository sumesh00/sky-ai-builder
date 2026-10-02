const AppError = require('../utils/AppError')

const BACKEND_PROVIDERS = new Set(['express', 'strapi'])
const FIELD_TYPES = new Set([
  'boolean',
  'date',
  'datetime',
  'decimal',
  'email',
  'integer',
  'media',
  'richtext',
  'string',
  'text',
])
const NAME_PATTERN = /^[a-z][a-z0-9-]{1,47}$/

function invalidBackendPlan() {
  throw new AppError('The AI provider returned an invalid backend specification', 502, 'AI_PLAN_INVALID')
}

function toSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function validateBackendGeneration(value) {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidBackendPlan()

  const keys = Object.keys(value)
  if (!keys.every((key) => ['contentTypes', 'provider'].includes(key))) invalidBackendPlan()
  if (!BACKEND_PROVIDERS.has(value.provider) || !Array.isArray(value.contentTypes)) invalidBackendPlan()
  if (value.contentTypes.length > 8) invalidBackendPlan()

  const names = new Set()
  for (const contentType of value.contentTypes) {
    if (!contentType || typeof contentType !== 'object' || Array.isArray(contentType)) invalidBackendPlan()
    if (!['fields', 'name'].every((key) => Object.hasOwn(contentType, key))) invalidBackendPlan()
    if (!Object.keys(contentType).every((key) => ['fields', 'name'].includes(key))) invalidBackendPlan()
    const slug = toSlug(contentType.name)
    if (!NAME_PATTERN.test(slug) || names.has(slug) || !Array.isArray(contentType.fields) || contentType.fields.length > 16) invalidBackendPlan()
    names.add(slug)

    const fieldNames = new Set()
    for (const field of contentType.fields) {
      if (!field || typeof field !== 'object' || Array.isArray(field)) invalidBackendPlan()
      if (!['name', 'required', 'type'].every((key) => Object.hasOwn(field, key))) invalidBackendPlan()
      if (!Object.keys(field).every((key) => ['name', 'required', 'type'].includes(key))) invalidBackendPlan()
      const fieldName = toSlug(field.name).replace(/-/g, '_')
      if (!/^[a-z][a-z0-9_]{0,47}$/.test(fieldName) || fieldNames.has(fieldName) || !FIELD_TYPES.has(field.type) || typeof field.required !== 'boolean') invalidBackendPlan()
      fieldNames.add(fieldName)
    }
  }

  return value
}

function normalizeContentTypes(contentTypes = []) {
  return contentTypes.map((contentType) => ({
    fields: contentType.fields.map((field) => ({
      ...field,
      name: toSlug(field.name).replace(/-/g, '_'),
    })),
    name: contentType.name.trim(),
    slug: toSlug(contentType.name),
  }))
}

module.exports = { normalizeContentTypes, validateBackendGeneration }
