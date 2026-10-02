import { useState } from 'react'
import { runProjectVisualCheck } from '../services/api.js'

function VisualCheck({ project, previewStatus }) {
  const [check, setCheck] = useState(null)
  const [error, setError] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const canRun = Boolean(project && previewStatus === 'running' && !isRunning)

  async function runCheck() {
    if (!canRun) return
    setError('')
    setIsRunning(true)
    try {
      setCheck(await runProjectVisualCheck(project.id))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <section className="border-b border-white/8 px-3 py-2.5 sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Visual verification
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-700">
            Captures desktop, tablet, and mobile renders.
          </p>
        </div>
        <button
          className="rounded-lg border border-violet-400/20 bg-violet-500/[0.07] px-2.5 py-1.5 text-[10px] font-medium text-violet-200 hover:bg-violet-500/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canRun}
          onClick={runCheck}
          title={project ? 'Run a rendered visual check' : 'Select a project first'}
          type="button"
        >
          {isRunning ? 'Checking…' : 'Run visual check'}
        </button>
      </div>
      {error ? <p className="mt-2 text-[10px] text-red-300">{error}</p> : null}
      {check ? (
        <p className="mt-2 text-[10px] leading-4 text-zinc-500">
          {check.findings.length
            ? `${check.findings.length} issue(s) found across ${check.screenshots.length} viewports.`
            : `No browser-detected issues across ${check.screenshots.length} viewports.`}
        </p>
      ) : null}
    </section>
  )
}

export default VisualCheck
