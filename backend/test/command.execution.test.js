const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { after, before, test } = require('node:test')
const LocalWorkspaceProvider = require('../src/workspace/localWorkspaceProvider')

let provider
let temporaryRoot

before(async () => {
  temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-builder-command-'))
  provider = new LocalWorkspaceProvider({
    maxFileBytes: 1024 * 1024,
    maxListEntries: 500,
    maxSearchResults: 100,
    rootPath: temporaryRoot,
  })
})

after(async () => {
  await fs.rm(temporaryRoot, { force: true, recursive: true })
})

test('runs without inheriting Builder AI secrets', async () => {
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'must-not-reach-project'

  try {
    const result = await provider.runCommand({
      args: ['-e', 'process.stdout.write(String(process.env.OPENAI_API_KEY))'],
      executable: process.execPath,
      maxOutputBytes: 1024,
      timeoutMs: 2000,
    })

    assert.equal(result.status, 'succeeded')
    assert.equal(result.stdout, 'undefined')
    assert.equal(result.stderr, '')
  } finally {
    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = previousKey
    }
  }
})

test('terminates commands that exceed the output limit', async () => {
  const result = await provider.runCommand({
    args: ['-e', "process.stdout.write('x'.repeat(4096))"],
    executable: process.execPath,
    maxOutputBytes: 100,
    timeoutMs: 2000,
  })

  assert.equal(result.status, 'failed')
  assert.equal(result.terminationReason, 'output_limit')
  assert.equal(Buffer.byteLength(result.stdout), 100)
})

test('terminates commands that exceed the time limit', async () => {
  const result = await provider.runCommand({
    args: ['-e', 'setInterval(() => {}, 1000)'],
    executable: process.execPath,
    maxOutputBytes: 1024,
    timeoutMs: 100,
  })

  assert.equal(result.status, 'failed')
  assert.equal(result.terminationReason, 'timeout')
})
