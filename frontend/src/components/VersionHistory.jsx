import { useCallback, useEffect, useState } from 'react'
import {
  createProjectSnapshot,
  getProjectVersionDiff,
  getProjectVersions,
  restoreProjectVersion,
} from '../services/api.js'

function VersionHistory({ onChanged, previewStatus, project }) {
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [pendingRestore, setPendingRestore] = useState(null)
  const [summary, setSummary] = useState('')
  const [versions, setVersions] = useState([])
  const previewIsActive = ['starting', 'running'].includes(previewStatus)

  const loadVersions = useCallback(async () => {
    try {
      setVersions(await getProjectVersions(project.id))
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [project.id])

  useEffect(() => {
    let isCurrent = true
    getProjectVersions(project.id)
      .then((nextVersions) => {
        if (isCurrent) setVersions(nextVersions)
      })
      .catch((requestError) => {
        if (isCurrent) setError(requestError.message)
      })
    return () => { isCurrent = false }
  }, [project.id])

  async function snapshot() {
    setError('')
    setIsBusy(true)
    try {
      const result = await createProjectSnapshot(project.id)
      setSummary(result.created ? `Saved ${result.version.id.slice(0, 7)}.` : 'No source changes to save.')
      await loadVersions()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsBusy(false)
    }
  }

  async function compare(revision) {
    setError('')
    try {
      setSummary((await getProjectVersionDiff(project.id, revision)).summary)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function restore() {
    if (!pendingRestore) return
    setError('')
    setIsBusy(true)
    try {
      const result = await restoreProjectVersion(project.id, pendingRestore.id)
      setSummary(result.restored ? `Restored ${pendingRestore.id.slice(0, 7)}.` : 'Project already matches this version.')
      setPendingRestore(null)
      await loadVersions()
      onChanged()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section className="border-t border-white/8 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Version history</p>
        <button className="rounded-md border border-white/8 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40" disabled={isBusy || previewIsActive} onClick={snapshot} type="button">Snapshot</button>
      </div>
      {previewIsActive ? <p className="mt-2 text-[10px] leading-4 text-zinc-600">Stop the preview before creating or restoring a version.</p> : null}
      {versions.slice(0, 4).map((version) => (
        <div className="mt-2 rounded-md border border-white/8 bg-white/[0.02] p-2" key={version.id}>
          <p className="truncate text-[10px] text-zinc-300" title={version.message}>{version.message}</p>
          <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-zinc-600"><span>{version.id.slice(0, 7)}</span><span>{new Date(version.createdAt).toLocaleString()}</span></div>
          <div className="mt-2 flex gap-2"><button className="text-[9px] text-violet-300 hover:text-violet-200" onClick={() => compare(version.id)} type="button">Compare</button><button className="text-[9px] text-amber-300 hover:text-amber-200 disabled:opacity-40" disabled={previewIsActive || isBusy} onClick={() => setPendingRestore(version)} type="button">Restore</button></div>
        </div>
      ))}
      {pendingRestore ? <div className="mt-2 rounded-md border border-amber-400/15 bg-amber-400/[0.04] p-2 text-[10px] text-zinc-400"><p>Restore {pendingRestore.id.slice(0, 7)}? Current changes are first saved as a snapshot.</p><div className="mt-2 flex gap-2"><button className="flex-1 rounded border border-white/8 py-1 text-zinc-500" onClick={() => setPendingRestore(null)} type="button">Cancel</button><button className="flex-1 rounded bg-amber-400/15 py-1 text-amber-200" onClick={restore} type="button">Confirm restore</button></div></div> : null}
      {summary ? <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-zinc-600">{summary}</pre> : null}
      {error ? <p className="mt-2 text-[10px] text-red-300">{error}</p> : null}
    </section>
  )
}

export default VersionHistory
