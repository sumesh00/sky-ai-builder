const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  validateReferenceImage,
} = require('../src/references/referenceImage')
const {
  ReferenceImageService,
} = require('../src/services/referenceImage.service')

function png(width = 800, height = 600) {
  const image = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(image)
  image.writeUInt32BE(13, 8)
  image.write('IHDR', 12, 'ascii')
  image.writeUInt32BE(width, 16)
  image.writeUInt32BE(height, 20)
  return image
}

test('validates image signature, declared content type, and dimensions', () => {
  const image = validateReferenceImage(png(), 'image/png', '../inspiration.png')

  assert.deepEqual(image, {
    extension: 'png',
    fileName: 'inspiration.png',
    height: 600,
    mediaType: 'image/png',
    size: 24,
    width: 800,
  })

  assert.throws(
    () => validateReferenceImage(png(), 'image/jpeg', 'inspiration.jpg'),
    (error) => error.code === 'REFERENCE_IMAGE_TYPE_MISMATCH',
  )
  assert.throws(
    () => validateReferenceImage(Buffer.from('not an image'), 'image/png', 'bad.png'),
    (error) => error.code === 'REFERENCE_IMAGE_UNSUPPORTED',
  )
})

test('stores references through the root workspace service and hides storage paths', async () => {
  const writes = []
  const files = new Map()
  const projectService = {
    async getProject(projectId) {
      return { id: projectId }
    },
    async touchProject() {},
  }
  const workspace = {
    async readFile(path) {
      if (!files.has(path)) {
        const error = new Error('missing')
        error.code = 'WORKSPACE_PATH_NOT_FOUND'
        throw error
      }

      return { content: files.get(path) }
    },
    async writeBinaryFile(path, content) {
      writes.push({ content, path })
    },
    async writeFile(path, content) {
      files.set(path, content)
    },
  }
  const service = new ReferenceImageService({ projectService, workspace })

  const reference = await service.uploadReference('travel-site', png(), {
    contentType: 'image/png',
    fileName: 'travel reference.png',
  })

  assert.equal(reference.storagePath, undefined)
  assert.equal(reference.fileName, 'travel reference.png')
  assert.match(writes[0].path, /^travel-site\/\.ai-builder\/references\//)
  assert.match(writes[0].path, /\.png$/)
  assert.equal(writes[0].content.equals(png()), true)
  const references = await service.listReferences('travel-site')
  assert.equal(references.length, 1)
  assert.deepEqual(references[0], reference)
})
