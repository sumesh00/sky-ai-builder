const assert = require('node:assert/strict')
const { test } = require('node:test')
const { FigmaClient, summarizeDocument } = require('../src/figma/figmaClient')
const { parseFigmaUrl } = require('../src/figma/figmaUrl')

test('parses a supported Figma design URL and optional node', () => {
  assert.deepEqual(
    parseFigmaUrl('https://www.figma.com/design/AbCdEfGhIjKlMNop/Travel?node-id=12%3A34'),
    {
      fileKey: 'AbCdEfGhIjKlMNop',
      nodeId: '12:34',
      url: 'https://www.figma.com/design/AbCdEfGhIjKlMNop/Travel?node-id=12%3A34',
    },
  )
})

test('rejects non-Figma and unsafe Figma URL variants', () => {
  for (const value of [
    'http://www.figma.com/design/AbCdEfGhIjKlMNop/Test',
    'https://example.com/design/AbCdEfGhIjKlMNop/Test',
    'https://www.figma.com/proto/AbCdEfGhIjKlMNop/Test',
    'https://www.figma.com/design/../../backend',
  ]) {
    assert.throws(() => parseFigmaUrl(value), { code: 'FIGMA_URL_INVALID' })
  }
})

test('summarizes Figma structure without returning the full document', () => {
  const summary = summarizeDocument({
    children: [
      {
        children: [
          { characters: 'Explore destinations', type: 'TEXT' },
          { name: 'Primary button', type: 'COMPONENT' },
        ],
        name: 'Hero',
        type: 'FRAME',
      },
    ],
    type: 'DOCUMENT',
  })

  assert.equal(summary.frames[0], 'Hero')
  assert.equal(summary.components[0], 'Primary button')
  assert.equal(summary.textExamples[0], 'Explore destinations')
  assert.equal(summary.nodeTypes.TEXT, 1)
})

test('uses the Figma node endpoint when a node is selected', async () => {
  let requestedUrl = ''
  const client = new FigmaClient({
    accessToken: 'figma-token',
    fetchImplementation: async (url) => {
      requestedUrl = url.toString()
      return {
        json: async () => ({
          name: 'Travel',
          nodes: { '1:2': { document: { children: [], type: 'FRAME' } } },
        }),
        ok: true,
      }
    },
  })

  const result = await client.inspect(
    'https://www.figma.com/design/AbCdEfGhIjKlMNop/Travel?node-id=1%3A2',
  )

  assert.match(requestedUrl, /\/files\/AbCdEfGhIjKlMNop\/nodes\?ids=1%3A2/)
  assert.equal(result.nodeId, '1:2')
  assert.equal(result.designName, 'Travel')
})
