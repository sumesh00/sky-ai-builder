import { useEffect, useState } from 'react'
import {
  getProjectCommands,
  runProjectCommand,
} from '../services/api.js'
import { CodeIcon } from './Icons.jsx'

function ProjectCommands({ onCommandFinished, previewStatus, project }) {
  const [capabilities, setCapabilities] = useState(null)
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [result, setResult] = useState(null)
  const [runningAction, setRunningAction] = useState('')
  const previewIsActive = ['starting', 'running'].includes(previewStatus)

  useEffect(() => {
    let isCurrent = true

    getProjectCommands(project.id)
      .then((value) => {
        if (isCurrent) {
          setCapabilities(value)
        }
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(requestError.message)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [previewStatus, project.id])

  async function executeCommand() {
    if (!pendingAction || runningAction) {
      return
    }

    const action = pendingAction

    setError('')
    setPendingAction(null)
    setResult(null)
    setRunningAction(action.id)

    try {
      const commandResult = await runProjectCommand(project.id, action.id)
      setResult(commandResult)
      onCommandFinished()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setRunningAction('')
    }
  }

  return (
    <section className="border-t border-white/8 p-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        <CodeIcon className="size-3.5" />
        Project commands
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {(capabilities?.actions || []).map((action) => (
          <button
            className="rounded-lg border border-white/8 bg-white/[0.025] px-2 py-2 text-[10px] font-medium text-zinc-400 hover:border-violet-400/20 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={Boolean(
              runningAction ||
                capabilities.activeAction ||
                capabilities.blockedByPreview ||
                previewIsActive,
            )}
            key={action.id}
            onClick={() => setPendingAction(action)}
            title={action.description}
            type="button"
          >
            {runningAction === action.id ? 'Running...' : action.label}
          </button>
        ))}
      </div>

      {capabilities?.blockedByPreview || previewIsActive ? (
        <p className="mt-2 text-[10px] leading-4 text-zinc-600">
          Stop the live preview before installing dependencies or building.
        </p>
      ) : null}

      {pendingAction ? (
        <div className="mt-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.04] p-2.5">
          <p className="text-[10px] leading-4 text-zinc-400">
            Run <span className="font-medium text-amber-200">{pendingAction.label}</span>{' '}
            inside {project.id}?
          </p>
          <div className="mt-2 flex gap-1.5">
            <button
              className="flex-1 rounded-md border border-white/8 px-2 py-1.5 text-[10px] text-zinc-500 hover:text-zinc-300"
              onClick={() => setPendingAction(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="flex-1 rounded-md bg-amber-400/15 px-2 py-1.5 text-[10px] font-medium text-amber-200 hover:bg-amber-400/20"
              onClick={executeCommand}
              type="button"
            >
              Confirm run
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-lg border border-red-400/15 bg-red-400/5 px-2.5 py-2 text-[10px] leading-4 text-red-300">
          {error}
        </p>
      ) : null}

      {result ? (
        <details className="mt-2 rounded-lg border border-white/8 bg-black/15 p-2.5 text-[10px] text-zinc-500">
          <summary className="cursor-pointer font-medium text-zinc-400">
            {result.action} · {result.status}
          </summary>
          <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words font-mono leading-4">
            {result.stdout || result.stderr || 'Command completed without output.'}
          </pre>
        </details>
      ) : null}
    </section>
  )
}

export default ProjectCommands
