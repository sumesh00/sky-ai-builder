function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function strapiAttribute(field) {
  const attribute = { type: field.type }
  if (field.required) attribute.required = true
  return attribute
}

function buildStrapiFiles({ name, contentTypes }) {
  const files = [
    {
      path: 'backend/package.json',
      content: json({
        name: `${name}-backend`,
        private: true,
        version: '0.1.0',
        scripts: { develop: 'strapi develop', start: 'strapi start' },
        dependencies: { '@strapi/strapi': '^5.0.0', 'better-sqlite3': '^11.0.0' },
      }),
    },
    { path: 'backend/.env.example', content: 'HOST=0.0.0.0\nPORT=1337\nAPP_KEYS=replace-me-1,replace-me-2\nAPI_TOKEN_SALT=replace-me\nADMIN_JWT_SECRET=replace-me\nTRANSFER_TOKEN_SALT=replace-me\nJWT_SECRET=replace-me\n' },
    { path: 'backend/config/server.js', content: "module.exports = ({ env }) => ({ host: env('HOST', '0.0.0.0'), port: env.int('PORT', 1337), app: { keys: env.array('APP_KEYS') } })\n" },
    { path: 'backend/config/database.js', content: "module.exports = ({ env }) => ({ connection: { client: 'sqlite', connection: { filename: env('DATABASE_FILENAME', '.tmp/data.db') }, useNullAsDefault: true } })\n" },
    { path: 'backend/src/index.js', content: "module.exports = { register() {}, bootstrap() {} }\n" },
  ]

  for (const contentType of contentTypes) {
    files.push({
      path: `backend/src/api/${contentType.slug}/content-types/${contentType.slug}/schema.json`,
      content: json({
        collectionName: `${contentType.slug}s`,
        info: { displayName: contentType.name, pluralName: `${contentType.slug}s`, singularName: contentType.slug },
        kind: 'collectionType',
        options: { draftAndPublish: true },
        attributes: Object.fromEntries(contentType.fields.map((field) => [field.name, strapiAttribute(field)])),
      }),
    })
  }

  return files
}

module.exports = { buildStrapiFiles }
