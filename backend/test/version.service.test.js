const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { after, before, test } = require('node:test')
const { getWorkspaceConfig } = require('../src/config/workspace')
const { VersionService } = require('../src/services/version.service')
const LocalWorkspaceProvider = require('../src/workspace/localWorkspaceProvider')

let root
let service
let workspace

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-builder-git-'))
  workspace = new LocalWorkspaceProvider({ ...getWorkspaceConfig(), rootPath: root })
  service = new VersionService({ workspaceFactory: async () => workspace })
  await workspace.writeFile('README.md', '# Version test\n')
})

after(async () => {
  await fs.rm(root, { force: true, recursive: true })
})

test('initializes, snapshots, compares, and restores a local project repository', async () => {
  const initialized = await service.initialize('test-project')
  assert.equal(initialized.status, 'ready')
  assert.equal((await service.list('test-project')).length, 1)

  await workspace.writeFile('README.md', '# Version test\nChanged\n', { overwrite: true })
  const snapshot = await service.snapshot('test-project', 'Update readme')
  assert.equal(snapshot.created, true)
  assert.equal(snapshot.version.message, 'Update readme')

  const diff = await service.diff('test-project', initialized.latestVersion?.id || (await service.list('test-project'))[1].id)
  assert.match(diff.summary, /README\.md/)

  const firstVersion = (await service.list('test-project')).at(-1)
  const restored = await service.restore('test-project', firstVersion.id)
  assert.equal(restored.restored, true)
  assert.equal((await workspace.readFile('README.md')).content.replace(/\r\n/g, '\n'), '# Version test\n')
})

test('rejects unsafe revisions before Git is invoked', async () => {
  await assert.rejects(() => service.diff('test-project', '../HEAD'), { code: 'GIT_REVISION_INVALID' })
})
