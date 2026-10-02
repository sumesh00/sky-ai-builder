const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { after, before, test } = require('node:test')

let apiServer
let apiUrl
let temporaryRoot

function png(width = 800, height = 600) {
  const image = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(image)
  image.writeUInt32BE(13, 8)
  image.write('IHDR', 12, 'ascii')
  image.writeUInt32BE(width, 16)
  image.writeUInt32BE(height, 20)
  return image
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address()))
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

before(async () => {
  temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-builder-references-'))
  const projectRoot = path.join(temporaryRoot, 'travel-site')
  await fs.mkdir(path.join(projectRoot, '.ai-builder'), { recursive: true })
  await fs.writeFile(
    path.join(projectRoot, '.ai-builder', 'project.json'),
    JSON.stringify({
      createdAt: new Date().toISOString(),
      id: 'travel-site',
      name: 'Travel Site',
      schemaVersion: 1,
      type: 'frontend',
      updatedAt: new Date().toISOString(),
    }),
  )

  process.env.WORKSPACE_ROOT = temporaryRoot
  const app = require('../src/app')
  apiServer = http.createServer(app)
  const apiAddress = await listen(apiServer)
  apiUrl = `http://127.0.0.1:${apiAddress.port}`
})

after(async () => {
  await close(apiServer)
  await fs.rm(temporaryRoot, { force: true, recursive: true })
  delete process.env.WORKSPACE_ROOT
})

test('uploads, lists, and serves a validated project reference image', async () => {
  const sourceImage = png()
  const uploadResponse = await fetch(
    `${apiUrl}/api/projects/travel-site/reference-images`,
    {
      body: sourceImage,
      headers: {
        'Content-Type': 'image/png',
        'X-Reference-Name': '../travel-inspiration.png',
      },
      method: 'POST',
    },
  )
  const upload = await uploadResponse.json()

  assert.equal(uploadResponse.status, 201)
  assert.equal(upload.data.fileName, 'travel-inspiration.png')
  assert.equal(upload.data.width, 800)
  assert.equal(upload.data.height, 600)
  assert.equal(upload.data.storagePath, undefined)

  const listingResponse = await fetch(
    `${apiUrl}/api/projects/travel-site/reference-images`,
  )
  const listing = await listingResponse.json()
  assert.equal(listingResponse.status, 200)
  assert.equal(listing.data.length, 1)
  assert.equal(listing.data[0].id, upload.data.id)
  assert.equal(JSON.stringify(listing).includes('.ai-builder'), false)

  const imageResponse = await fetch(
    `${apiUrl}/api/projects/travel-site/reference-images/${upload.data.id}`,
  )
  const image = Buffer.from(await imageResponse.arrayBuffer())
  assert.equal(imageResponse.status, 200)
  assert.equal(imageResponse.headers.get('content-type'), 'image/png')
  assert.equal(image.equals(sourceImage), true)
})

test('rejects image content that does not match its declared type', async () => {
  const response = await fetch(
    `${apiUrl}/api/projects/travel-site/reference-images`,
    {
      body: png(),
      headers: { 'Content-Type': 'image/jpeg' },
      method: 'POST',
    },
  )
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.error.code, 'REFERENCE_IMAGE_TYPE_MISMATCH')
})
