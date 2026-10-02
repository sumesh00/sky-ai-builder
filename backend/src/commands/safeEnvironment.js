const ALLOWED_ENVIRONMENT_VARIABLES = [
  'APPDATA',
  'ComSpec',
  'HOME',
  'LANG',
  'LOCALAPPDATA',
  'PATH',
  'PATHEXT',
  'ProgramFiles',
  'ProgramFiles(x86)',
  'ProgramW6432',
  'SystemDrive',
  'SystemRoot',
  'TEMP',
  'TMP',
  'TMPDIR',
  'USERPROFILE',
  'WINDIR',
]

function createSafeEnvironment(source = process.env) {
  const environment = {}

  for (const name of ALLOWED_ENVIRONMENT_VARIABLES) {
    if (source[name]) {
      environment[name] = source[name]
    }
  }

  environment.CI = 'true'
  environment.NPM_CONFIG_AUDIT = 'false'
  environment.NPM_CONFIG_FUND = 'false'
  environment.NPM_CONFIG_UPDATE_NOTIFIER = 'false'

  return environment
}

module.exports = { createSafeEnvironment }
