const {
  MAX_ANALYZED_BYTES,
  MAX_ANALYZED_FILES,
  analyzeResponsiveSources,
  isFrontendSourcePath,
} = require('../responsive/responsiveAnalyzer')
const { RESPONSIVE_VIEWPORTS } = require('../responsive/viewportProfiles')
const { ProjectService } = require('./project.service')
const { createProjectWorkspaceService } = require('./workspace.service')

class ResponsiveAuditService {
  constructor({
    projectService = new ProjectService(),
    workspaceFactory = createProjectWorkspaceService,
  } = {}) {
    this.projectService = projectService
    this.workspaceFactory = workspaceFactory
  }

  async auditProject(projectId) {
    const project = await this.projectService.getProject(projectId)
    const workspace = await this.workspaceFactory(project.id)
    const listing = await workspace.listFiles('frontend', { depth: 10 })
    const sourceEntries = listing.entries.filter(
      (entry) => entry.type === 'file' && isFrontendSourcePath(entry.path),
    )
    const files = []
    let totalBytes = 0

    for (const entry of sourceEntries.slice(0, MAX_ANALYZED_FILES)) {
      if (totalBytes + entry.size > MAX_ANALYZED_BYTES) {
        continue
      }

      const file = await workspace.readFile(entry.path)
      totalBytes += file.size
      files.push(file)
    }

    const analysis = analyzeResponsiveSources(files)
    const summary = analysis.findings.reduce(
      (counts, finding) => {
        counts[finding.severity] += 1
        return counts
      },
      { error: 0, info: 0, warning: 0 },
    )

    return {
      ...analysis,
      analyzedAt: new Date().toISOString(),
      limitations:
        'Static source review only. It does not execute the generated project or verify rendered pixels.',
      projectId: project.id,
      summary,
      truncated:
        sourceEntries.length > MAX_ANALYZED_FILES || totalBytes >= MAX_ANALYZED_BYTES,
      viewports: RESPONSIVE_VIEWPORTS,
    }
  }
}

const responsiveAuditService = new ResponsiveAuditService()

module.exports = { ResponsiveAuditService, responsiveAuditService }
