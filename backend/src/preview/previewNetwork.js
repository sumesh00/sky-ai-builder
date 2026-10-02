const http = require('node:http')
const net = require('node:net')
const AppError = require('../utils/AppError')

const FIRST_PREVIEW_PORT = 5200
const LAST_PREVIEW_PORT = 5299

function isPortAvailable(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => resolve(false))
    server.listen(port, host, () => {
      server.close(() => resolve(true))
    })
  })
}

async function allocatePreviewPort(host, reservedPorts = new Set()) {
  for (let port = FIRST_PREVIEW_PORT; port <= LAST_PREVIEW_PORT; port += 1) {
    if (!reservedPorts.has(port) && (await isPortAvailable(port, host))) {
      return port
    }
  }

  throw new AppError(
    'No preview ports are currently available',
    503,
    'PREVIEW_PORT_UNAVAILABLE',
  )
}

function probePreview(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume()
      resolve(response.statusCode < 500)
    })

    request.setTimeout(500, () => {
      request.destroy()
      resolve(false)
    })
    request.once('error', () => resolve(false))
  })
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitForPreview(url, processHandle, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (processHandle.getSnapshot().status !== 'running') {
      return false
    }

    if (await probePreview(url)) {
      return true
    }

    await delay(100)
  }

  return false
}

module.exports = { allocatePreviewPort, waitForPreview }
