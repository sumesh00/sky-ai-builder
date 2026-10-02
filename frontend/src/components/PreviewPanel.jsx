import { useCallback, useEffect, useState } from 'react'
import {
  getProjectPreview,
  startProjectPreview,
  stopProjectPreview,
} from '../services/api.js'
import DeviceSwitcher from './DeviceSwitcher.jsx'
import { RefreshIcon } from './Icons.jsx'
import ResponsiveAudit from './ResponsiveAudit.jsx'
import VisualCheck from './VisualCheck.jsx'

const previewSizes = {
  desktop: {
    frame: 'max-w-full',
    label: 'Responsive width',
  },
  mobile: {
    frame: 'max-w-[390px]',
    label: '390 × 844',
  },
  tablet: {
    frame: 'max-w-[768px]',
    label: '768 × 1024',
  },
}

const stoppedPreview = {
  output: '',
  status: 'stopped',
  url: null,
}

function PreviewPanel({ activeProject, onStatusChange, projectRevision }) {
  const [activeDevice, setActiveDevice] = useState('desktop')
  const [busy, setBusy] = useState(false)
  const [confirmStart, setConfirmStart] = useState(false)
  const [error, setError] = useState('')
  const [frameVersion, setFrameVersion] = useState(0)
  const [previewState, setPreviewState] = useState(stoppedPreview)
  const projectId = activeProject?.id || ''
  const preview = previewSizes[activeDevice]

  const updatePreview = useCallback(
    (nextPreview) => {
      setPreviewState(nextPreview)
      onStatusChange(nextPreview.status)
    },
    [onStatusChange],
  )

  const loadPreview = useCallback(async () => {
    if (!projectId) {
      updatePreview(stoppedPreview)
      return
    }

    try {
      const result = await getProjectPreview(projectId)
      updatePreview(result)
    } catch (requestError) {
      setError(requestError.message)
      updatePreview(stoppedPreview)
    }
  }, [projectId, updatePreview])

  useEffect(() => {
    if (!projectId) {
      return undefined
    }

    const timer = window.setTimeout(loadPreview, 0)
    return () => window.clearTimeout(timer)
  }, [loadPreview, projectId])

  useEffect(() => {
    if (!['starting', 'running'].includes(previewState.status)) {
      return undefined
    }

    const timer = window.setInterval(loadPreview, 2500)
    return () => window.clearInterval(timer)
  }, [loadPreview, previewState.status])

  async function startPreview() {
    if (!projectId || busy) {
      return
    }

    setBusy(true)
    setConfirmStart(false)
    setError('')
    updatePreview({ ...stoppedPreview, status: 'starting' })

    try {
      const result = await startProjectPreview(projectId)
      updatePreview(result)
      setFrameVersion((current) => current + 1)
    } catch (requestError) {
      setError(requestError.message)
      await loadPreview()
    } finally {
      setBusy(false)
    }
  }

  async function stopPreview() {
    if (!projectId || busy) {
      return
    }

    setBusy(true)
    setError('')

    try {
      updatePreview(await stopProjectPreview(projectId))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const isRunning = previewState.status === 'running'
  const isStarting = previewState.status === 'starting'

  return (
    <section
      className="flex min-h-[560px] min-w-0 flex-col bg-[#0a0a0c] md:min-h-[520px] xl:min-h-0"
      id="live-preview"
    >
      <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3 py-2 sm:px-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Live preview
            </p>
            <span
              className={`size-1.5 rounded-full ${
                isRunning
                  ? 'bg-emerald-400'
                  : isStarting
                    ? 'animate-pulse bg-amber-300'
                    : 'bg-zinc-700'
              }`}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-600">{preview.label}</p>
        </div>

        <div className="flex items-center gap-2">
          <DeviceSwitcher
            activeDevice={activeDevice}
            onChange={setActiveDevice}
          />
          <button
            aria-label="Refresh preview"
            className="flex size-8 items-center justify-center rounded-lg border border-white/8 bg-[#111114] text-zinc-500 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!isRunning}
            onClick={() => setFrameVersion((current) => current + 1)}
            title="Reload preview"
            type="button"
          >
            <RefreshIcon className="size-3.5" />
          </button>
        </div>
      </div>

      <ResponsiveAudit
        project={activeProject}
        projectRevision={projectRevision}
      />
      <VisualCheck project={activeProject} previewStatus={previewState.status} />

      <div className="preview-grid flex flex-1 items-stretch justify-center overflow-auto p-3 sm:p-5">
        <div
          className={`flex min-h-[440px] w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#111114] shadow-2xl shadow-black/30 transition-[max-width] duration-300 ${preview.frame}`}
        >
          <div className="flex h-10 shrink-0 items-center gap-3 border-b border-white/8 bg-[#151519] px-3">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="size-2 rounded-full bg-white/10" />
              <span className="size-2 rounded-full bg-white/10" />
              <span className="size-2 rounded-full bg-white/10" />
            </div>
            <div className="flex h-6 min-w-0 flex-1 items-center truncate rounded-md border border-white/5 bg-black/20 px-2.5 text-[10px] text-zinc-600">
              {isRunning || isStarting
                ? previewState.url || 'Allocating preview URL'
                : 'Preview server is stopped'}
            </div>
            {isRunning ? (
              <button
                className="rounded-md border border-white/8 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                disabled={busy}
                onClick={stopPreview}
                type="button"
              >
                {busy ? 'Stopping…' : 'Stop'}
              </button>
            ) : null}
          </div>

          {isRunning ? (
            <iframe
              className="min-h-0 flex-1 bg-white"
              key={`${previewState.url}-${frameVersion}-${projectRevision}`}
              sandbox="allow-forms allow-modals allow-same-origin allow-scripts"
              src={previewState.url}
              title={`${activeProject.name} live preview`}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/[0.07] text-violet-300/70">
                  <span className="text-lg font-semibold">&lt;/&gt;</span>
                </div>
                <h2 className="text-sm font-medium text-zinc-300">
                  {!activeProject
                    ? 'Select or generate a project'
                    : isStarting
                      ? 'Starting preview server'
                      : previewState.status === 'failed'
                        ? 'Preview could not start'
                        : 'Preview is ready to start'}
                </h2>
                <p className="mt-2 text-xs leading-5 text-zinc-600">
                  {!activeProject
                    ? 'An active generated project is required for Live Preview.'
                    : isStarting
                      ? 'Waiting for the generated frontend to become available.'
                      : 'Dependencies must be installed before starting the generated frontend.'}
                </p>

                {activeProject && !isStarting ? (
                  <button
                    className="mt-5 rounded-lg border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-xs font-medium text-violet-200 hover:bg-violet-500/15 disabled:opacity-40"
                    disabled={busy}
                    onClick={() => setConfirmStart(true)}
                    type="button"
                  >
                    Start preview
                  </button>
                ) : null}

                {confirmStart ? (
                  <div className="mt-4 rounded-lg border border-amber-400/15 bg-amber-400/[0.04] p-3 text-left">
                    <p className="text-[11px] leading-5 text-zinc-400">
                      Start the generated frontend? Its development configuration
                      will execute inside this project workspace.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="flex-1 rounded-md border border-white/8 px-2 py-1.5 text-[10px] text-zinc-500 hover:text-zinc-300"
                        onClick={() => setConfirmStart(false)}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="flex-1 rounded-md bg-amber-400/15 px-2 py-1.5 text-[10px] font-medium text-amber-200 hover:bg-amber-400/20"
                        onClick={startPreview}
                        type="button"
                      >
                        Confirm start
                      </button>
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <p className="mt-4 text-xs leading-5 text-red-300">{error}</p>
                ) : null}

                {previewState.output ? (
                  <details className="mt-4 rounded-lg border border-white/8 bg-black/20 p-3 text-left text-[10px] text-zinc-500">
                    <summary className="cursor-pointer text-zinc-400">
                      Preview output
                    </summary>
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono leading-4">
                      {previewState.output}
                    </pre>
                  </details>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default PreviewPanel
