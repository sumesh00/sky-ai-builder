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

test('uses the full file endpoint without a shallow depth limit when no node is selected', async () => {
  let requestedUrl = ''
  const client = new FigmaClient({
    accessToken: 'figma-token',
    fetchImplementation: async (url, options) => {
      requestedUrl = url.toString()
      assert.equal(options.headers['X-Figma-Token'], 'figma-token')
      return {
        json: async () => ({
          document: { children: [], name: 'Full file frame', type: 'FRAME' },
          name: 'Full file',
        }),
        ok: true,
      }
    },
  })

  const result = await client.inspect(
    'https://www.figma.com/design/AbCdEfGhIjKlMNop/Full-file',
  )

  assert.equal(requestedUrl, 'https://api.figma.com/v1/files/AbCdEfGhIjKlMNop')
  assert.equal(result.designSpecification.hierarchy.name, 'Full file frame')
})

test('extracts a bounded design specification with hierarchy, layout, visual tokens, text, and image availability', async () => {
  const requests = []
  const client = new FigmaClient({
    accessToken: 'figma-token',
    fetchImplementation: async (url, options) => {
      const requestedUrl = url.toString()
      requests.push({ headers: options.headers, url: requestedUrl })

      if (requestedUrl.endsWith('/images')) {
        return {
          json: async () => ({
            meta: { images: { 'image-ref-1': 'https://figma-assets.example/image.png' } },
          }),
          ok: true,
        }
      }

      return {
        json: async () => ({
          name: 'Motion Travel',
          nodes: {
            '12:34': {
              document: {
                absoluteBoundingBox: { height: 900, width: 1440, x: 0, y: 0 },
                children: [
                  {
                    absoluteBoundingBox: { height: 700, width: 1440, x: 0, y: 0 },
                    children: [
                      {
                        absoluteBoundingBox: { height: 120, width: 500, x: 80, y: 180 },
                        characters: 'Travel beyond the ordinary',
                        name: 'Hero headline',
                        style: {
                          fontFamily: 'Inter',
                          fontSize: 72,
                          fontWeight: 700,
                          lineHeightPx: 80,
                        },
                        type: 'TEXT',
                      },
                      {
                        absoluteBoundingBox: { height: 700, width: 640, x: 800, y: 0 },
                        fills: [
                          { imageRef: 'image-ref-1', scaleMode: 'FILL', type: 'IMAGE' },
                        ],
                        name: 'Video panel',
                        type: 'RECTANGLE',
                      },
                    ],
                    fills: [{ color: { b: 0.18, g: 0.12, r: 0.06 }, type: 'SOLID' }],
                    itemSpacing: 24,
                    layoutMode: 'HORIZONTAL',
                    name: 'Scroll banner',
                    paddingBottom: 40,
                    paddingLeft: 80,
                    paddingRight: 80,
                    paddingTop: 40,
                    type: 'FRAME',
                  },
                ],
                name: 'Landing page',
                type: 'FRAME',
              },
            },
          },
        }),
        ok: true,
      }
    },
  })

  const result = await client.inspect(
    'https://www.figma.com/design/AbCdEfGhIjKlMNop/Motion?node-id=12%3A34',
  )
  const specification = result.designSpecification
  const banner = specification.hierarchy.children[0]

  assert.equal(requests.length, 2)
  assert.match(requests[0].url, /\/nodes\?ids=12%3A34/)
  assert.match(requests[1].url, /\/files\/AbCdEfGhIjKlMNop\/images$/)
  assert.equal(requests.every((request) => request.headers['X-Figma-Token'] === 'figma-token'), true)
  assert.equal(specification.version, 1)
  assert.deepEqual(specification.hierarchy.bounds, { height: 900, width: 1440, x: 0, y: 0 })
  assert.equal(banner.layout.direction, 'HORIZONTAL')
  assert.equal(banner.layout.gap, 24)
  assert.equal(banner.layout.padding.left, 80)
  assert.equal(banner.children[0].text.content, 'Travel beyond the ordinary')
  assert.equal(banner.children[0].text.fontFamily, 'Inter')
  assert.equal(specification.colors.includes('#0f1f2e'), true)
  assert.deepEqual(specification.images, [{ available: true, imageRef: 'image-ref-1' }])
})
