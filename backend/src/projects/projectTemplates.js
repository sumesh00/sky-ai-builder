function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function buildReadme({ name, plan, type }) {
  const requirements = plan.requirements
    .map((requirement) => `- ${requirement}`)
    .join('\n')

  return `# ${name}

${plan.summary}

## Project structure

- \`frontend/\` — React and Vite application
${type === 'full-stack' ? '- `backend/` — Node.js and Express API\n' : ''}
## Initial requirements

${requirements}

## Development

Install dependencies in the project when you are ready to begin development.
This project is ordinary source code and can be edited independently of AI Website Builder.
`
}

function buildDeploymentGuide({ type }) {
  return `# Deployment guide

## Before deployment

1. Install dependencies in each project folder.
2. Copy every \`.env.example\` file to \`.env\` and set real values outside source control.
3. Run the frontend build from \`frontend/\`.
${type === 'full-stack' ? '4. Configure and deploy the backend separately, including its database and runtime environment.\n' : ''}
## Export

This project can be downloaded from AI Website Builder as a normal ZIP archive.
It contains editable source files only. Dependencies, build output, Git data, Builder metadata, and real environment files are excluded.
`
}

function buildFrontendFiles({ name, plan }) {
  const requirements = JSON.stringify(plan.requirements, null, 2)
  const summary = JSON.stringify(plan.summary)

  return [
    {
      path: 'frontend/package.json',
      content: json({
        name: `${name}-frontend`,
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: {
          build: 'vite build',
          dev: 'vite',
          preview: 'vite preview',
        },
        dependencies: {
          react: '^19.2.0',
          'react-dom': '^19.2.0',
        },
        devDependencies: {
          '@tailwindcss/vite': '^4.0.0',
          '@vitejs/plugin-react': '^6.0.0',
          tailwindcss: '^4.0.0',
          vite: '^8.0.0',
        },
      }),
    },
    {
      path: 'frontend/index.html',
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content=${JSON.stringify(plan.summary)} />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
    },
    {
      path: 'frontend/vite.config.js',
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
`,
    },
    {
      path: 'frontend/src/main.jsx',
      content: `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,
    },
    {
      path: 'frontend/src/App.jsx',
      content: `const requirements = ${requirements}

function App() {
  return (
    <main>
      <p className="eyebrow">Generated project foundation</p>
      <h1>${name}</h1>
      <p className="summary">{${summary}}</p>
      <section>
        <h2>Initial requirements</h2>
        <ul>
          {requirements.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
`,
    },
    {
      path: 'frontend/src/index.css',
      content: `@import "tailwindcss";

:root {
  color: #f4f4f5;
  background: #09090b;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-synthesis: none;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
main { width: min(720px, calc(100% - 40px)); margin: 0 auto; padding: 96px 0; }
.eyebrow { color: #a78bfa; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
h1 { margin: 12px 0; font-size: clamp(2.5rem, 8vw, 5rem); line-height: 1; }
.summary { color: #a1a1aa; font-size: 1.125rem; line-height: 1.7; }
section { margin-top: 48px; padding: 24px; border: 1px solid #27272a; border-radius: 16px; background: #111113; }
h2 { margin-top: 0; font-size: 1rem; }
li { margin-top: 10px; color: #d4d4d8; line-height: 1.5; }
`,
    },
  ]
}

function buildBackendFiles({ name, contentTypes = [], authentication, database }) {
  const contentRouteImport = contentTypes.length
    ? "const contentRoutes = require('./routes/content.routes')\n"
    : ''
  const contentRouteMount = contentTypes.length
    ? "app.use('/api/content-types', contentRoutes)\n"
    : ''
  const authRouteImport = authentication
    ? "const authRoutes = require('./auth/auth.routes')\n"
    : ''
  const authRouteMount = authentication ? "app.use('/api/auth', authRoutes)\n" : ''
  const dataDependencies = database
    ? {
        '@prisma/client': '^6.0.0',
        prisma: '^6.0.0',
        ...(authentication
          ? { bcryptjs: '^2.4.3', jsonwebtoken: '^9.0.2' }
          : {}),
      }
    : {}
  return [
    {
      path: 'backend/package.json',
      content: json({
        name: `${name}-backend`,
        private: true,
        version: '0.1.0',
        main: 'src/server.js',
        type: 'commonjs',
        scripts: {
          dev: 'nodemon src/server.js',
          start: 'node src/server.js',
        },
        dependencies: {
          cors: '^2.8.5',
          dotenv: '^16.4.0',
          express: '^5.1.0',
          ...dataDependencies,
        },
        devDependencies: {
          nodemon: '^3.1.0',
        },
      }),
    },
    {
      path: 'backend/.env.example',
      content: 'PORT=5000\nFRONTEND_URL=http://localhost:5173\n',
    },
    {
      path: 'backend/src/app.js',
      content: `const cors = require('cors')
const express = require('express')
${contentRouteImport}
${authRouteImport}

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (request, response) => {
  response.json({ success: true, message: '${name} API is running' })
})
${contentRouteMount}
${authRouteMount}

module.exports = app
`,
    },
    {
      path: 'backend/src/server.js',
      content: `require('dotenv').config()

const app = require('./app')
const port = process.env.PORT || 5000

app.listen(port, () => {
  console.log(\`${name} API listening on port \${port}\`)
})
`,
    },
  ]
}

const { normalizeContentTypes } = require('./backendGeneration')
const { buildStrapiFiles } = require('./strapiTemplates')
const { buildDataFiles } = require('./dataTemplates')

function buildExpressContentFiles({ contentTypes }) {
  if (contentTypes.length === 0) return []
  return [
    {
      path: 'backend/src/content/contentTypes.js',
      content: `module.exports = ${json(contentTypes)} `,
    },
    {
      path: 'backend/src/routes/content.routes.js',
      content: `const express = require('express')\nconst contentTypes = require('../content/contentTypes')\n\nconst router = express.Router()\nrouter.get('/', (request, response) => response.json({ success: true, data: contentTypes }))\nrouter.get('/:contentType', (request, response) => {\n  const contentType = contentTypes.find((item) => item.slug === request.params.contentType)\n  if (!contentType) return response.status(404).json({ success: false, message: 'Content type not found' })\n  return response.json({ success: true, data: { contentType, items: [] } })\n})\n\nmodule.exports = router\n`,
    },
  ]
}

function buildProjectFiles({ name, plan, projectId, type }) {
  const workspaces = type === 'full-stack' ? ['frontend', 'backend'] : ['frontend']
  const files = [
    {
      path: 'package.json',
      content: json({
        name: projectId,
        private: true,
        version: '0.1.0',
        description: plan.summary,
        workspaces,
      }),
    },
    {
      path: '.gitignore',
      content: 'node_modules/\ndist/\n.env\n.env.*\n!.env.example\n*.log\n.ai-builder/references/\n.ai-builder/visual-checks/\n',
    },
    {
      path: 'README.md',
      content: buildReadme({ name, plan, type }),
    },
    {
      path: 'DEPLOYMENT.md',
      content: buildDeploymentGuide({ type }),
    },
    ...buildFrontendFiles({ name: projectId, plan }),
  ]

  if (type === 'full-stack') {
    const backendGeneration = plan.backendGeneration || { contentTypes: [], provider: 'express' }
    const contentTypes = normalizeContentTypes(backendGeneration.contentTypes)
    if (backendGeneration.provider === 'strapi') {
      files.push(...buildStrapiFiles({ contentTypes, name: projectId }))
    } else {
      files.push(...buildBackendFiles({ authentication: plan.authentication, contentTypes, database: plan.databaseGeneration, name: projectId }))
      files.push(...buildExpressContentFiles({ contentTypes }))
      if (plan.databaseGeneration) {
        const dataFiles = buildDataFiles({ authentication: plan.authentication, database: plan.databaseGeneration })
        const retainedFiles = files.filter((file) => file.path !== 'backend/.env.example')
        files.length = 0
        files.push(...retainedFiles, ...dataFiles)
      }
    }
  }

  return files
}

module.exports = { buildProjectFiles }
