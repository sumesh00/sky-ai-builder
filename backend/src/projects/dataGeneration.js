const AppError = require('../utils/AppError')

const DATABASE_PROVIDERS = new Set(['sqlite', 'postgresql', 'mysql'])
const FIELD_TYPES = new Set(['boolean', 'date', 'datetime', 'decimal', 'email', 'integer', 'password', 'string', 'text', 'uuid'])
const RELATION_TYPES = new Set(['many-to-many', 'many-to-one', 'one-to-one'])
const ROLE_PERMISSION_PATTERN = /^[a-z][a-z0-9:._-]{1,63}$/

function invalidPlan() {
  throw new AppError('The AI provider returned an invalid database or authentication specification', 502, 'AI_PLAN_INVALID')
}

function modelName(value) {
  return value.trim().replace(/[^A-Za-z0-9]/g, '')
}

function validModelName(value) {
  return typeof value === 'string' && /^[A-Z][A-Za-z0-9]{1,47}$/.test(modelName(value))
}

function validateDataGeneration(value) {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidPlan()
  if (!Object.keys(value).every((key) => ['entities', 'provider', 'relationships'].includes(key))) invalidPlan()
  if (!DATABASE_PROVIDERS.has(value.provider) || !Array.isArray(value.entities) || !Array.isArray(value.relationships)) invalidPlan()
  if (value.entities.length > 12 || value.relationships.length > 20) invalidPlan()

  const names = new Set()
  for (const entity of value.entities) {
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) invalidPlan()
    if (!Object.keys(entity).every((key) => ['fields', 'name'].includes(key)) || !Object.hasOwn(entity, 'fields') || !Object.hasOwn(entity, 'name')) invalidPlan()
    const name = modelName(entity.name)
    if (!validModelName(entity.name) || names.has(name) || !Array.isArray(entity.fields) || entity.fields.length > 20) invalidPlan()
    names.add(name)
    const fields = new Set()
    for (const field of entity.fields) {
      if (!field || typeof field !== 'object' || Array.isArray(field)) invalidPlan()
      if (!Object.keys(field).every((key) => ['name', 'required', 'type', 'unique'].includes(key))) invalidPlan()
      if (!['name', 'required', 'type', 'unique'].every((key) => Object.hasOwn(field, key))) invalidPlan()
      if (!/^[a-z][A-Za-z0-9]{0,47}$/.test(field.name) || ['id', 'createdAt', 'updatedAt'].includes(field.name) || fields.has(field.name) || !FIELD_TYPES.has(field.type) || typeof field.required !== 'boolean' || typeof field.unique !== 'boolean') invalidPlan()
      fields.add(field.name)
    }
  }

  for (const relationship of value.relationships) {
    if (!relationship || typeof relationship !== 'object' || Array.isArray(relationship)) invalidPlan()
    if (!Object.keys(relationship).every((key) => ['source', 'target', 'type'].includes(key))) invalidPlan()
    if (!['source', 'target', 'type'].every((key) => Object.hasOwn(relationship, key))) invalidPlan()
    if (!names.has(modelName(relationship.source)) || !names.has(modelName(relationship.target)) || relationship.source === relationship.target || !RELATION_TYPES.has(relationship.type)) invalidPlan()
  }

  return value
}

function validateAuthentication(value, dataGeneration) {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidPlan()
  if (!Object.keys(value).every((key) => ['enabled', 'roles'].includes(key))) invalidPlan()
  if (value.enabled !== true || !Array.isArray(value.roles) || value.roles.length < 1 || value.roles.length > 8) invalidPlan()
  if (dataGeneration?.entities.some((entity) => modelName(entity.name) === 'User')) invalidPlan()

  const names = new Set()
  for (const role of value.roles) {
    if (!role || typeof role !== 'object' || Array.isArray(role)) invalidPlan()
    if (!Object.keys(role).every((key) => ['name', 'permissions'].includes(key))) invalidPlan()
    if (!Object.hasOwn(role, 'name') || !Object.hasOwn(role, 'permissions') || typeof role.name !== 'string' || !/^[A-Za-z][A-Za-z0-9 -]{1,47}$/.test(role.name) || names.has(role.name) || !Array.isArray(role.permissions) || role.permissions.some((permission) => typeof permission !== 'string' || !ROLE_PERMISSION_PATTERN.test(permission))) invalidPlan()
    names.add(role.name)
  }

  return value
}

module.exports = { modelName, validateAuthentication, validateDataGeneration }
