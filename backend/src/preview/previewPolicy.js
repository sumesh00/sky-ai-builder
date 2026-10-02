const path = require('node:path')

const PREVIEW_HOST = '127.0.0.1'
const PREVIEW_MAX_OUTPUT_BYTES = 512 * 1024
const PREVIEW_STARTUP_TIMEOUT_MS = 15 * 1000

function getPreviewPolicy(port) {
  return Object.freeze({
    args: Object.freeze([
      path.join('node_modules', 'vite', 'bin', 'vite.js'),
      'frontend',
      '--host',
      PREVIEW_HOST,
      '--port',
      String(port),
      '--strictPort',
    ]),
    executable: process.execPath,
    maxOutputBytes: PREVIEW_MAX_OUTPUT_BYTES,
  })
}

module.exports = {
  PREVIEW_HOST,
  PREVIEW_STARTUP_TIMEOUT_MS,
  getPreviewPolicy,
}
