const { modelName } = require('./dataGeneration')

const PRISMA_TYPES = {
  boolean: 'Boolean', date: 'DateTime', datetime: 'DateTime', decimal: 'Decimal', email: 'String', integer: 'Int', password: 'String', string: 'String', text: 'String', uuid: 'String',
}

function plural(name) {
  return `${name.charAt(0).toLowerCase()}${name.slice(1)}s`
}

function prismaField(field) {
  const optional = field.required ? '' : '?'
  const unique = field.unique ? ' @unique' : ''
  return `  ${field.name} ${PRISMA_TYPES[field.type]}${optional}${unique}`
}

function relationshipFields(entities, relationships) {
  const fields = new Map(entities.map((entity) => [modelName(entity.name), []]))
  for (const relationship of relationships) {
    const source = modelName(relationship.source)
    const target = modelName(relationship.target)
    const relationName = `${source}${target}`
    if (relationship.type === 'many-to-many') {
      fields.get(source).push(`  ${plural(target)} ${target}[] @relation("${relationName}")`)
      fields.get(target).push(`  ${plural(source)} ${source}[] @relation("${relationName}")`)
      continue
    }
    const sourceField = `${target.charAt(0).toLowerCase()}${target.slice(1)}`
    const foreignKey = `${sourceField}Id`
    const oneToOne = relationship.type === 'one-to-one'
    fields.get(source).push(`  ${sourceField} ${target} @relation("${relationName}", fields: [${foreignKey}], references: [id])`)
    fields.get(source).push(`  ${foreignKey} String${oneToOne ? ' @unique' : ''}`)
    fields.get(target).push(`  ${plural(source)} ${source}${oneToOne ? '?' : '[]'} @relation("${relationName}")`)
  }
  return fields
}

function buildPrismaSchema({ authentication, database }) {
  const provider = database.provider === 'postgresql' ? 'postgresql' : database.provider
  const relationMap = relationshipFields(database.entities, database.relationships)
  const models = database.entities.map((entity) => {
    const name = modelName(entity.name)
    return `model ${name} {\n  id String @id @default(cuid())\n${entity.fields.map(prismaField).join('\n')}${entity.fields.length ? '\n' : ''}${relationMap.get(name).join('\n')}\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}`
  })
  if (authentication) {
    models.push(`model User {\n  id String @id @default(cuid())\n  email String @unique\n  passwordHash String\n  role String\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}`)
  }
  return `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "${provider}"\n  url = env("DATABASE_URL")\n}\n\n${models.join('\n\n')}\n`
}

function buildDataFiles({ authentication, database }) {
  const databaseUrl = database.provider === 'sqlite' ? 'file:./dev.db' : 'replace-with-your-database-url'
  const files = [
    { path: 'backend/prisma/schema.prisma', content: buildPrismaSchema({ authentication, database }) },
    { path: 'backend/.env.example', content: `PORT=5000\nFRONTEND_URL=http://localhost:5173\nDATABASE_URL=${databaseUrl}\n${authentication ? 'JWT_SECRET=replace-with-a-long-random-secret\n' : ''}` },
    { path: 'backend/src/database/client.js', content: "const { PrismaClient } = require('@prisma/client')\n\nconst database = new PrismaClient()\n\nmodule.exports = database\n" },
  ]
  if (authentication) {
    const roles = JSON.stringify(authentication.roles, null, 2)
    files.push(
      { path: 'backend/src/auth/roles.js', content: `const roles = ${roles}\n\nmodule.exports = { roles }\n` },
      { path: 'backend/src/auth/auth.routes.js', content: "const bcrypt = require('bcryptjs')\nconst express = require('express')\nconst jwt = require('jsonwebtoken')\nconst database = require('../database/client')\nconst { roles } = require('./roles')\n\nconst router = express.Router()\nconst defaultRole = roles[0].name\nfunction token(user) { return jwt.sign({ role: user.role, sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' }) }\nrouter.post('/register', async (request, response, next) => { try { const { email, password, role = defaultRole } = request.body; if (!email || !password || !roles.some((item) => item.name === role)) return response.status(400).json({ success: false, message: 'Invalid registration details' }); const user = await database.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12), role } }); return response.status(201).json({ success: true, data: { token: token(user), user: { email: user.email, id: user.id, role: user.role } } }); } catch (error) { return next(error) } })\nrouter.post('/login', async (request, response, next) => { try { const user = await database.user.findUnique({ where: { email: request.body.email } }); if (!user || !(await bcrypt.compare(request.body.password || '', user.passwordHash))) return response.status(401).json({ success: false, message: 'Invalid email or password' }); return response.json({ success: true, data: { token: token(user), user: { email: user.email, id: user.id, role: user.role } } }); } catch (error) { return next(error) } })\nmodule.exports = router\n" },
      { path: 'backend/src/auth/requireAuth.js', content: "const jwt = require('jsonwebtoken')\n\nfunction requireAuth(request, response, next) { const token = request.headers.authorization?.replace(/^Bearer\\s+/i, ''); if (!token) return response.status(401).json({ success: false, message: 'Authentication required' }); try { request.user = jwt.verify(token, process.env.JWT_SECRET); return next() } catch { return response.status(401).json({ success: false, message: 'Invalid authentication token' }) } }\nfunction requirePermission(permission) { return (request, response, next) => { const { roles } = require('./roles'); const role = roles.find((item) => item.name === request.user.role); if (!role?.permissions.includes(permission)) return response.status(403).json({ success: false, message: 'Permission denied' }); return next() } }\nmodule.exports = { requireAuth, requirePermission }\n" },
    )
  }
  return files
}

module.exports = { buildDataFiles }
