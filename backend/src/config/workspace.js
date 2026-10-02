const path = require('node:path')

const DEFAULT_WORKSPACE_ROOT = path.resolve(__dirname, '../../../workspace')

function getWorkspaceConfig() {
  const configuredRoot = process.env.WORKSPACE_ROOT

  return {
    maxFileBytes: 1024 * 1024,
    maxListEntries: 500,
    maxSearchResults: 100,
    rootPath: configuredRoot
      ? path.resolve(__dirname, '../../', configuredRoot)
      : DEFAULT_WORKSPACE_ROOT,
  }
}

module.exports = { getWorkspaceConfig }
