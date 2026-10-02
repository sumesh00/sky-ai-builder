const { randomUUID } = require('node:crypto')
const AppError = require('../utils/AppError')
const { validateProjectId } = require('../projects/projectValidation')
const { projectProcessRegistry } = require('../processes/projectProcessRegistry')
const { VISUAL_CHECK_VIEWPORTS } = require('../visual/visualCheckProfiles')
const { previewService } = require('./preview.service')
const { ProjectService } = require('./project.service')
const { createWorkspaceService } = require('./workspace.service')

const CHECK_METADATA_PATH = '.ai-builder/visual-checks.json'
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
const MAX_STORED_CHECKS = 10

function metadataPath(projectId) {
  return `${validateProjectId(projectId)}/${CHECK_METADATA_PATH}`
}

function screenshotPath(projectId, checkId, viewportId) {
  return `${validateProjectId(projectId)}/.ai-builder/visual-checks/${checkId}/${viewportId}.png`
}

function publicCheck(check) {
  const { screenshots, ...details } = check
  return {
    ...details,
    screenshots: screenshots.map(({ storagePath, ...screenshot }) => screenshot),
  }
}

function parseChecks(file) {
  try {
    const value = JSON.parse(file.content)
    return value && Array.isArray(value.checks) ? value.checks : null
  } catch {
    return null
  }
}

function browserDiagnostics() {
  const root = document.documentElement
  const viewportWidth = window.innerWidth
  const overflowing = [...document.querySelectorAll('body *')]
    .filter((element) => {
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        (rect.right > viewportWidth + 1 || rect.left < -1)
      )
    })
    .slice(0, 8)
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
    }))

  return {
    documentHeight: root.scrollHeight,
    horizontalOverflow: root.scrollWidth > viewportWidth + 1,
    overflowElements: overflowing,
    viewportWidth,
  }
}

function toFindings(viewport, diagnostics, consoleErrors) {
  const findings = []
  if (diagnostics.horizontalOverflow) {
    findings.push({
      code: 'HORIZONTAL_OVERFLOW',
      message: `Page content is wider than the ${viewport.label.toLowerCase()} viewport.`,
      severity: 'warning',
      viewport: viewport.id,
    })
  }
  if (diagnostics.overflowElements.length) {
    findings.push({
      code: 'ELEMENT_OUTSIDE_VIEWPORT',
      message: `${diagnostics.overflowElements.length} visible element(s) extend outside the viewport.`,
      severity: 'warning',
      viewport: viewport.id,
    })
  }
  for (const message of consoleErrors.slice(0, 5)) {
    findings.push({
      code: 'BROWSER_CONSOLE_ERROR',
      message: message.slice(0, 240),
      severity: 'error',
      viewport: viewport.id,
    })
  }
  return findings
}

class VisualCheckService {
  constructor({
    browserLauncher,
    preview = previewService,
    processRegistry = projectProcessRegistry,
    projectService = new ProjectService(),
    workspace = createWorkspaceService(),
  } = {}) {
    this.browserLauncher = browserLauncher
    this.preview = preview
    this.processRegistry = processRegistry
    this.projectService = projectService
    this.workspace = workspace
  }

  async getChecks(projectId) {
    const safeProjectId = validateProjectId(projectId)
    await this.projectService.getProject(safeProjectId)
    try {
      const file = await this.workspace.readFile(metadataPath(safeProjectId))
      const checks = parseChecks(file)
      if (!checks) {
        throw new AppError('Visual check metadata is invalid', 409, 'VISUAL_CHECK_METADATA_INVALID')
      }
      return checks
    } catch (error) {
      if (error.code === 'WORKSPACE_PATH_NOT_FOUND') {
        return []
      }
      throw error
    }
  }

  async run(projectId) {
    const project = await this.projectService.getProject(projectId)
    const preview = await this.preview.getStatus(project.id)
    if (preview.status !== 'running' || !preview.url) {
      throw new AppError('Start the project preview before running a visual check', 409, 'PREVIEW_NOT_RUNNING')
    }

    const processId = randomUUID()
    if (!this.processRegistry.tryAcquire(project.id, { id: processId, kind: 'visual-check' })) {
      throw new AppError('Another incompatible project process is active', 409, 'PROJECT_PROCESS_ACTIVE')
    }

    let browser
    try {
      const launch = this.browserLauncher || (() => require('playwright').chromium.launch({ headless: true }))
      browser = await launch()
      const checkId = randomUUID()
      const findings = []
      const screenshots = []

      for (const viewport of VISUAL_CHECK_VIEWPORTS) {
        const page = await browser.newPage({ viewport: { height: viewport.height, width: viewport.width } })
        const consoleErrors = []
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text())
        })
        await page.goto(preview.url, { timeout: 15000, waitUntil: 'domcontentloaded' })
        const diagnostics = await page.evaluate(browserDiagnostics)
        const screenshot = await page.screenshot({ type: 'png' })
        if (screenshot.length > MAX_SCREENSHOT_BYTES) {
          throw new AppError('A visual-check screenshot exceeded 5 MiB', 413, 'VISUAL_CHECK_SCREENSHOT_TOO_LARGE')
        }
        const storagePath = screenshotPath(project.id, checkId, viewport.id)
        await this.workspace.writeBinaryFile(storagePath, screenshot, { maxBytes: MAX_SCREENSHOT_BYTES })
        screenshots.push({
          height: viewport.height,
          id: viewport.id,
          label: viewport.label,
          size: screenshot.length,
          storagePath,
          width: viewport.width,
        })
        findings.push(...toFindings(viewport, diagnostics, consoleErrors))
        await page.close()
      }

      const check = {
        createdAt: new Date().toISOString(),
        findings,
        id: checkId,
        previewUrl: preview.url,
        screenshots,
        schemaVersion: 1,
      }
      const previous = await this.getChecks(project.id)
      const checks = [check, ...previous].slice(0, MAX_STORED_CHECKS)
      await this.workspace.writeFile(
        metadataPath(project.id),
        `${JSON.stringify({ checks, schemaVersion: 1 }, null, 2)}\n`,
        { overwrite: true },
      )
      await this.projectService.touchProject(project.id)
      return publicCheck(check)
    } finally {
      await browser?.close()
      this.processRegistry.release(project.id, processId)
    }
  }
}

const visualCheckService = new VisualCheckService()

module.exports = { VisualCheckService, visualCheckService }
