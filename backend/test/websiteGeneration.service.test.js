const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  MAX_GENERATED_FILE_BYTES,
  validateWebsiteGeneration,
} = require('../src/generation/websiteGenerationValidator')
const {
  WebsiteGenerationService,
} = require('../src/services/websiteGeneration.service')
const { ProjectService } = require('../src/services/project.service')

const APP_SOURCE = `import { useState } from 'react'

export default function App() {
  const [open, setOpen] = useState(false)
  return <main><button onClick={() => setOpen(!open)}>Explore</button></main>
}
`
const CSS_SOURCE = ':root { color: #172554; }\nmain { min-height: 100vh; }\n'
const FIGMA_APP_SOURCE = `import { useEffect, useRef, useState } from 'react'

export default function App() {
  const bannerRef = useRef(null)
  const hasPlayedRef = useRef(false)
  const videoRef = useRef(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const updateBanner = () => {
      const banner = bannerRef.current
      if (!banner) return
      const nextProgress = Math.max(0, Math.min(1, (window.innerHeight - banner.getBoundingClientRect().top) / window.innerHeight))
      setProgress(nextProgress)
      if (nextProgress >= 1 && !hasPlayedRef.current) {
        hasPlayedRef.current = true
        videoRef.current?.play().catch(() => {})
      }
    }
    updateBanner()
    window.addEventListener('scroll', updateBanner, { passive: true })
    return () => window.removeEventListener('scroll', updateBanner)
  }, [])

  return <section data-figma-scroll-banner ref={bannerRef} style={{ '--progress': progress }}><div>Travel</div><video muted playsInline ref={videoRef} /></section>
}
`

function generatedValue(overrides = {}) {
  return {
    files: [
      { content: APP_SOURCE, path: 'frontend/src/App.jsx' },
      { content: CSS_SOURCE, path: 'frontend/src/index.css' },
    ],
    summary: 'Built the approved responsive experience.',
    ...overrides,
  }
}

test('generates the two frontend files from the approved plan with a mocked provider', async () => {
  const requests = []
  const provider = {
    async generateStructured(request) {
      requests.push(request)
      return {
        model: 'mock-model',
        provider: 'mock-openai',
        responseId: 'resp_generated',
        value: generatedValue(),
      }
    },
  }
  const service = new WebsiteGenerationService({
    providerFactory: () => provider,
  })
  const result = await service.generate({
    approvedPlan: {
      plan: {
        projectType: 'frontend',
        requirements: ['Responsive navigation'],
        summary: 'Create a travel site',
      },
      request: 'Build a polished travel site',
    },
    name: 'Travel Anchor',
  })

  assert.deepEqual(
    result.files.map((file) => file.path),
    ['frontend/src/App.jsx', 'frontend/src/index.css'],
  )
  assert.equal(result.provider, 'mock-openai')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].name, 'website_files')
  assert.equal(requests[0].schema.properties.files.minItems, 2)
  assert.equal(requests[0].instructions.includes('Do not add or require packages'), true)
  assert.deepEqual(JSON.parse(requests[0].input), {
    approvedPlan: {
      projectType: 'frontend',
      requirements: ['Responsive navigation'],
      summary: 'Create a travel site',
    },
    designSpecification: null,
    originalRequest: 'Build a polished travel site',
    project: { name: 'Travel Anchor', type: 'frontend' },
  })
})

test('passes a Figma design specification to generation and requires the scroll banner interaction', async () => {
  const requests = []
  const service = new WebsiteGenerationService({
    providerFactory: () => ({
      async generateStructured(request) {
        requests.push(request)
        return {
          model: 'mock-model',
          provider: 'mock-openai',
          responseId: 'resp_figma',
          value: generatedValue({
            files: [
              { content: FIGMA_APP_SOURCE, path: 'frontend/src/App.jsx' },
              { content: CSS_SOURCE, path: 'frontend/src/index.css' },
            ],
          }),
        }
      },
    }),
  })
  const designSpecification = {
    colors: ['#0f1f2e'],
    hierarchy: { name: 'Landing page', type: 'FRAME' },
    version: 1,
  }

  await service.generate({
    approvedPlan: {
      designReference: { designSpecification },
      plan: { projectType: 'frontend', requirements: [], summary: 'Figma site' },
      request: 'Recreate the Figma travel frame',
    },
    name: 'Figma Travel',
  })

  assert.deepEqual(JSON.parse(requests[0].input).designSpecification, designSpecification)
  assert.equal(requests[0].instructions.includes('A non-null designSpecification is a Figma source of truth'), true)
  assert.equal(requests[0].instructions.includes('video.play() only after that final scroll position'), true)
})

test('rejects a Figma generation response without the required scroll banner interaction', () => {
  assert.throws(
    () => validateWebsiteGeneration(generatedValue(), { requireFigmaScrollBanner: true }),
    (error) => error.code === 'AI_WEBSITE_GENERATION_INVALID',
  )
})

test('accepts files in either order and normalizes them to the fixed target order', () => {
  const value = generatedValue()
  value.files.reverse()

  assert.deepEqual(
    validateWebsiteGeneration(value).files.map((file) => file.path),
    ['frontend/src/App.jsx', 'frontend/src/index.css'],
  )
})

test('rejects missing, duplicate, extra, and unsafe output paths', () => {
  const invalidFileSets = [
    [{ content: APP_SOURCE, path: 'frontend/src/App.jsx' }],
    [
      { content: APP_SOURCE, path: 'frontend/src/App.jsx' },
      { content: APP_SOURCE, path: 'frontend/src/App.jsx' },
    ],
    [
      { content: APP_SOURCE, path: 'frontend/src/App.jsx' },
      { content: CSS_SOURCE, path: '../index.css' },
    ],
    [
      { content: APP_SOURCE, path: 'frontend/src/App.jsx' },
      { content: CSS_SOURCE, path: 'frontend/src/index.css' },
      { content: 'secret', path: '.env' },
    ],
  ]

  for (const files of invalidFileSets) {
    assert.throws(
      () => validateWebsiteGeneration(generatedValue({ files })),
      (error) =>
        error.code === 'AI_WEBSITE_GENERATION_INVALID' && error.status === 502,
    )
  }
})

test('rejects unsafe, dependency-backed, fenced, and oversized file content', () => {
  const invalidContents = [
    {
      content: "import icons from 'icon-package'\nexport default function App() { return <main /> }",
      path: 'frontend/src/App.jsx',
    },
    {
      content: 'export default function App() { return <main dangerouslySetInnerHTML={{ __html: value }} /> }',
      path: 'frontend/src/App.jsx',
    },
    {
      content: '```jsx\nexport default function App() { return <main /> }\n```',
      path: 'frontend/src/App.jsx',
    },
    {
      content: `export default function App() { return <main>${'x'.repeat(MAX_GENERATED_FILE_BYTES)}</main> }`,
      path: 'frontend/src/App.jsx',
    },
    {
      content: '@import "remote.css";\nmain { color: red; }',
      path: 'frontend/src/index.css',
    },
  ]

  for (const invalidFile of invalidContents) {
    const value = generatedValue()
    value.files = value.files.map((file) =>
      file.path === invalidFile.path ? invalidFile : file,
    )

    assert.throws(
      () => validateWebsiteGeneration(value),
      (error) => error.code === 'AI_WEBSITE_GENERATION_INVALID',
    )
  }
})

test('writes no project files when the mocked provider returns invalid generation output', async () => {
  const writes = []
  const workspace = {
    async listFiles() {
      return { entries: [] }
    },
    async writeFile(path, content, options) {
      writes.push({ content, options, path })
    },
  }
  const generation = new WebsiteGenerationService({
    providerFactory: () => ({
      async generateStructured() {
        return {
          model: 'mock-model',
          provider: 'mock-openai',
          responseId: 'resp_invalid',
          value: generatedValue({
            files: [
              { content: APP_SOURCE, path: 'frontend/src/App.jsx' },
              { content: CSS_SOURCE, path: '../outside.css' },
            ],
          }),
        }
      },
    }),
  })
  const plans = {
    requireApproved() {
      return {
        id: 'approved-plan',
        model: 'mock-model',
        plan: { projectType: 'frontend' },
        provider: 'mock-openai',
        request: 'Build a safe site',
        responseId: 'resp_plan',
        version: 1,
      }
    },
  }
  const service = new ProjectService({
    plans,
    websiteGeneration: generation,
    workspace,
  })

  await assert.rejects(
    service.createProject({
      name: 'Safe Site',
      planId: 'approved-plan',
      planVersion: 1,
    }),
    (error) => error.code === 'AI_WEBSITE_GENERATION_INVALID',
  )
  assert.equal(writes.length, 0)
})
