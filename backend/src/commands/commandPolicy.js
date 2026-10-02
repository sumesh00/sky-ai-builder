const AppError = require('../utils/AppError')
const { getNpmInvocation } = require('./npmInvocation')

const npmInvocation = getNpmInvocation()

const COMMANDS = Object.freeze({
  install: Object.freeze({
    args: Object.freeze([
      ...npmInvocation.argsPrefix,
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
    ]),
    description: 'Install declared dependencies without lifecycle scripts.',
    executable: npmInvocation.executable,
    id: 'install',
    label: 'Install dependencies',
    maxOutputBytes: 256 * 1024,
    timeoutMs: 5 * 60 * 1000,
  }),
  build: Object.freeze({
    args: Object.freeze([
      ...npmInvocation.argsPrefix,
      'run',
      'build',
      '--workspace',
      'frontend',
    ]),
    description: 'Create a production build of the frontend workspace.',
    executable: npmInvocation.executable,
    id: 'build',
    label: 'Build frontend',
    maxOutputBytes: 256 * 1024,
    timeoutMs: 2 * 60 * 1000,
  }),
})

function getCommandPolicy(action) {
  if (typeof action !== 'string' || !COMMANDS[action]) {
    throw new AppError(
      'This project command is not allowed',
      400,
      'COMMAND_NOT_ALLOWED',
    )
  }

  return COMMANDS[action]
}

function listCommandPolicies() {
  return Object.values(COMMANDS).map(({ description, id, label }) => ({
    description,
    id,
    label,
    requiresConfirmation: true,
  }))
}

module.exports = { getCommandPolicy, listCommandPolicies }
