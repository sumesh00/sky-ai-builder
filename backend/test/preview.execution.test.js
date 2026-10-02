const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { after, before, test } = require('node:test')
const LocalWorkspaceProvider = require('../src/workspace/localWorkspaceProvider')

let provider
let temporaryRoot

before(async () => {
  temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-builder-preview-'))
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

test('starts and stops a persistent process without Builder secrets', async () => {
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'must-not-reach-preview'
  let handle

  try {
    handle = await provider.startProcess({
      args: [
        '-e',
        'console.log(String(process.env.OPENAI_API_KEY)); setInterval(() => {}, 1000)',
      ],
      executable: process.execPath,
      maxOutputBytes: 1024,
    })

    const deadline = Date.now() + 2000

    while (!handle.getSnapshot().stdout && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }

    assert.equal(handle.getSnapshot().status, 'running')
    assert.equal(handle.getSnapshot().stdout.trim(), 'undefined')

    const result = await handle.stop('stopped')
    assert.equal(result.status, 'stopped')
    assert.equal(result.terminationReason, 'stopped')
  } finally {
    if (handle?.getSnapshot().status === 'running') {
      await handle.stop('stopped')
    }

    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = previousKey
    }
  }
})

test('terminates a persistent process that exceeds its output limit', async () => {
  const handle = await provider.startProcess({
    args: ['-e', "setInterval(() => process.stdout.write('x'.repeat(100)), 1)"],
    executable: process.execPath,
    maxOutputBytes: 200,
  })
  const result = await handle.exit

  assert.equal(result.status, 'stopped')
  assert.equal(result.terminationReason, 'output_limit')
  assert.equal(Buffer.byteLength(result.stdout), 200)
})
