const SOURCE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.jsx',
  '.mjs',
  '.scss',
  '.ts',
  '.tsx',
])

const FRONTEND_PATH_PREFIX = 'frontend/'
const MAX_ANALYZED_FILES = 80
const MAX_ANALYZED_BYTES = 512 * 1024

function isFrontendSourcePath(path) {
  const filename = path.split('/').at(-1) || ''
  const extension = filename.includes('.')
    ? `.${filename.split('.').at(-1).toLocaleLowerCase()}`
    : ''

  return path.startsWith(FRONTEND_PATH_PREFIX) && SOURCE_EXTENSIONS.has(extension)
}

function lineNumber(content, offset) {
  return content.slice(0, offset).split(/\r?\n/).length
}

function createFinding({ code, line, message, path, severity, viewportIds }) {
  return { code, line, message, path, severity, viewportIds }
}

function addMatches(findings, file, expression, createMatchFinding) {
  for (const match of file.content.matchAll(expression)) {
    const finding = createMatchFinding({
      line: lineNumber(file.content, match.index),
      match,
      path: file.path,
    })

    if (finding) {
      findings.push(finding)
    }
  }
}

function analyzeFile(file) {
  const findings = []
  const lowerPath = file.path.toLocaleLowerCase()
  const isStyleFile = /\.(css|scss)$/.test(lowerPath)
  const isMarkupFile = /\.(html|jsx|tsx)$/.test(lowerPath)

  if (isStyleFile) {
    addMatches(
      findings,
      file,
      /(?:min-)?width\s*:\s*(\d{3,})px\b/gi,
      ({ line, match, path }) => {
        const pixels = Number(match[1])

        if (pixels <= 360) {
          return null
        }

        return createFinding({
          code: 'fixed-width',
          line,
          message: `Fixed ${pixels}px width can overflow narrow viewports unless a breakpoint overrides it.`,
          path,
          severity: pixels > 768 ? 'warning' : 'info',
          viewportIds: ['tablet', 'mobile-large', 'mobile', 'mobile-small'],
        })
      },
    )

    addMatches(
      findings,
      file,
      /grid-template-columns\s*:\s*repeat\(\s*([3-9]|[1-9]\d+)\s*,/gi,
      ({ line, match, path }) =>
        createFinding({
          code: 'fixed-grid-columns',
          line,
          message: `A ${match[1]}-column grid needs a narrow-screen rule or an auto-fit pattern.`,
          path,
          severity: 'warning',
          viewportIds: ['tablet', 'mobile-large', 'mobile', 'mobile-small'],
        }),
    )

    addMatches(
      findings,
      file,
      /position\s*:\s*absolute\b/gi,
      ({ line, path }) =>
        createFinding({
          code: 'absolute-layout',
          line,
          message: 'Absolute positioning often needs breakpoint-specific review.',
          path,
          severity: 'info',
          viewportIds: ['tablet', 'mobile-large', 'mobile', 'mobile-small'],
        }),
    )
  }

  if (isMarkupFile) {
    addMatches(
      findings,
      file,
      /\b(?:w|min-w)-\[([4-9]\d{2,}|\d{4,})px\]/g,
      ({ line, match, path }) =>
        createFinding({
          code: 'tailwind-fixed-width',
          line,
          message: `Tailwind's ${match[0]} can overflow narrow viewports without a responsive override.`,
          path,
          severity: 'warning',
          viewportIds: ['tablet', 'mobile-large', 'mobile', 'mobile-small'],
        }),
    )

    addMatches(
      findings,
      file,
      /\bgrid-cols-([3-9]|[1-9]\d+)\b/g,
      ({ line, match, path }) =>
        createFinding({
          code: 'tailwind-fixed-grid',
          line,
          message: `${match[0]} should have a smaller base grid for narrow viewports.`,
          path,
          severity: 'warning',
          viewportIds: ['tablet', 'mobile-large', 'mobile', 'mobile-small'],
        }),
    )
  }

  return findings
}

function analyzeResponsiveSources(files) {
  const sourceFiles = files.filter((file) => isFrontendSourcePath(file.path))
  const findings = []
  const indexHtml = sourceFiles.find((file) => file.path === 'frontend/index.html')
  const styles = sourceFiles.filter((file) => /\.(css|scss)$/.test(file.path))
  const components = sourceFiles.filter((file) => /\.(jsx|tsx|html)$/.test(file.path))

  if (!indexHtml || !/name=["']viewport["']/i.test(indexHtml.content)) {
    findings.push(
      createFinding({
        code: 'missing-viewport-meta',
        line: null,
        message: 'Add a viewport meta tag so mobile browsers use the device width.',
        path: indexHtml?.path || 'frontend/index.html',
        severity: 'error',
        viewportIds: ['mobile-large', 'mobile', 'mobile-small'],
      }),
    )
  }

  const hasImage = components.some((file) => /<img\b/i.test(file.content))
  const hasResponsiveImageRule = styles.some((file) =>
    /img\s*\{[^}]*max-width\s*:\s*100%/is.test(file.content),
  )

  if (hasImage && !hasResponsiveImageRule) {
    findings.push(
      createFinding({
        code: 'image-scaling-review',
        line: null,
        message: 'Review image sizing; no global max-width: 100% rule was found.',
        path: 'frontend/',
        severity: 'info',
        viewportIds: ['tablet', 'mobile-large', 'mobile', 'mobile-small'],
      }),
    )
  }

  for (const file of sourceFiles) {
    findings.push(...analyzeFile(file))
  }

  const severityOrder = { error: 0, warning: 1, info: 2 }

  return {
    analyzedFiles: sourceFiles.map((file) => file.path),
    findings: findings.sort((left, right) => {
      const severityDifference = severityOrder[left.severity] - severityOrder[right.severity]

      return severityDifference || left.path.localeCompare(right.path)
    }),
  }
}

module.exports = {
  MAX_ANALYZED_BYTES,
  MAX_ANALYZED_FILES,
  analyzeResponsiveSources,
  isFrontendSourcePath,
}
