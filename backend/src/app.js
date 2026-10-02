const cors = require('cors')
const express = require('express')
const errorHandler = require('./middleware/errorHandler')
const notFound = require('./middleware/notFound')
const aiRouter = require('./routes/ai.routes')
const healthRouter = require('./routes/health.routes')
const workspaceRouter = require('./routes/workspace.routes')
const projectRouter = require('./routes/project.routes')

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  }),
)
app.use('/api/health', healthRouter)
app.use('/api/ai', express.json({ limit: '32kb' }), aiRouter)
app.use('/api/workspace', express.json({ limit: '2200kb' }), workspaceRouter)
app.use('/api/projects', express.json({ limit: '64kb' }), projectRouter)

app.use(notFound)
app.use(errorHandler)

module.exports = app
