require('dotenv').config()

const app = require('./app')
const { previewService } = require('./services/preview.service')

const port = process.env.PORT || 5000

const server = app.listen(port, () => {
  console.log(`AI Website Builder API listening on port ${port}`)
})

let shuttingDown = false

async function shutdown() {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  await previewService.stopAll()
  server.close(() => process.exit(0))
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
