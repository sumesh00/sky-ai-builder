import { useState } from 'react'
import { auditProjectResponsiveness } from '../services/api.js'

const severityClasses = {
  error: 'border-red-400/15 bg-red-400/[0.06] text-red-200',
  info: 'border-sky-400/15 bg-sky-400/[0.05] text-sky-200',
  warning: 'border-amber-400/15 bg-amber-400/[0.05] text-amber-200',
}

function ResponsiveAudit({ project, projectRevision }) {
  const [auditState, setAuditState] = useState({
    audit: null,
    error: '',
    key: '',
    visible: false,
  })
  const [isRunning, setIsRunning] = useState(false)
  const auditKey = `${project?.id || ''}:${projectRevision}`
  const audit = auditState.key === auditKey ? auditState.audit : null
  const error = auditState.key === auditKey ? auditState.error : ''
  const isVisible = auditState.key === auditKey && auditState.visible

  async function runAudit() {
    if (!project || isRunning) {
      return
    }

    setIsRunning(true)
    setAuditState({ audit: null, error: '', key: auditKey, visible: true })

    try {
      const result = await auditProjectResponsiveness(project.id)
      setAuditState({ audit: result, error: '', key: auditKey, visible: true })
    } catch (requestError) {
      setAuditState({
        audit: null,
        error: requestError.message,
        key: auditKey,
        visible: true,
      })
    } finally {
      setIsRunning(false)
    }
  }

  const totalFindings = audit
    ? audit.summary.error + audit.summary.warning + audit.summary.info
    : 0

  return (
    <div className="border-b border-white/8 bg-[#0d0d10] px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-zinc-500">
            Responsive audit
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-700">
            Static checks across 1920px to 360px profiles
          </p>
        </div>
        <button
          className="rounded-md border border-violet-400/20 bg-violet-500/10 px-2.5 py-1.5 text-[10px] font-medium text-violet-200 hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!project || isRunning}
          onClick={runAudit}
          type="button"
        >
          {isRunning ? 'Checking…' : 'Run check'}
        </button>
      </div>

      {(audit || error) && isVisible ? (
        <div className="mt-2 rounded-lg border border-white/8 bg-black/15 p-2.5">
          {error ? <p className="text-[11px] text-red-300">{error}</p> : null}
          {audit ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                <span>{audit.analyzedFiles.length} source files checked</span>
                <span className="text-zinc-800">•</span>
                <span>{totalFindings} findings</span>
                {audit.summary.error ? (
                  <span className="text-red-300">{audit.summary.error} errors</span>
                ) : null}
                {audit.summary.warning ? (
                  <span className="text-amber-300">{audit.summary.warning} warnings</span>
                ) : null}
              </div>

              {totalFindings === 0 ? (
                <p className="mt-2 text-[11px] leading-4 text-emerald-300">
                  No common responsive risks were found in the checked source.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {audit.findings.slice(0, 5).map((finding) => (
                    <li
                      className={`rounded-md border px-2 py-1.5 text-[10px] leading-4 ${severityClasses[finding.severity]}`}
                      key={`${finding.path}-${finding.line}-${finding.code}`}
                    >
                      <span className="font-medium uppercase">{finding.severity}</span>
                      <span className="mx-1.5 opacity-50">·</span>
                      {finding.message}
                      <span className="mt-0.5 block truncate opacity-70">
                        {finding.path}
                        {finding.line ? `:${finding.line}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {audit.findings.length > 5 ? (
                <p className="mt-2 text-[10px] text-zinc-600">
                  {audit.findings.length - 5} more findings are available through the API.
                </p>
              ) : null}
              <p className="mt-2 text-[10px] leading-4 text-zinc-700">
                {audit.limitations}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default ResponsiveAudit
