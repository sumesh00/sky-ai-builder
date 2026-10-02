const fs = require('node:fs')
const path = require('node:path')

function getNpmInvocation() {
  if (process.platform !== 'win32') {
    return { argsPrefix: [], executable: 'npm' }
  }

  const npmCliPath = path.join(
    path.dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js',
  )

  if (!fs.existsSync(npmCliPath)) {
    throw new Error(`Unable to locate the npm CLI at ${npmCliPath}`)
  }

  return { argsPrefix: [npmCliPath], executable: process.execPath }
}

module.exports = { getNpmInvocation }
