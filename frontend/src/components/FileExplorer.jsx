import { useEffect, useState } from 'react'
import { getWorkspaceStatus, listWorkspaceFiles } from '../services/api.js'
import { FileIcon, FolderIcon, SidebarIcon } from './Icons.jsx'
import ProjectCommands from './ProjectCommands.jsx'
import VersionHistory from './VersionHistory.jsx'

function FileExplorer({
  activeProject,
  onSelectProject,
  projects,
  projectsState,
  previewStatus,
  projectRevision,
}) {
  const [fileListing, setFileListing] = useState({
    entries: [],
    projectId: '',
  })
  const [workspaceState, setWorkspaceState] = useState('loading')
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let isCurrent = true

    getWorkspaceStatus()
      .then((status) => {
        if (isCurrent) {
          setWorkspaceState(status.ready ? 'ready' : 'unavailable')
        }
      })
      .catch(() => {
        if (isCurrent) {
          setWorkspaceState('unavailable')
        }
      })

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    let isCurrent = true

    if (!activeProject) {
      return () => {
        isCurrent = false
      }
    }

    listWorkspaceFiles(activeProject.id, '.', 8)
      .then((listing) => {
        if (isCurrent) {
          setFileListing({
            entries: listing.entries,
            projectId: activeProject.id,
          })
          setWorkspaceState('ready')
        }
      })
      .catch(() => {
        if (isCurrent) {
          setFileListing({ entries: [], projectId: activeProject.id })
          setWorkspaceState('unavailable')
        }
      })

    return () => {
      isCurrent = false
    }
  }, [activeProject, projectRevision, refreshVersion])

  const entries =
    activeProject && fileListing.projectId === activeProject.id
      ? fileListing.entries
      : []

  const isLoading =
    projectsState === 'loading' ||
    workspaceState === 'loading' ||
    (activeProject && fileListing.projectId !== activeProject.id)

  return (
    <aside className="flex min-h-[280px] flex-col border-b border-white/8 bg-[#0e0e11] md:min-h-[520px] md:border-r md:border-b-0 xl:min-h-0">
      <div className="border-b border-white/8 px-3.5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            <SidebarIcon className="size-3.5" />
            Files
          </div>
          <span className="rounded-md bg-white/[0.035] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-600">
            Workspace
          </span>
        </div>

        {projects.length > 0 ? (
          <label className="mt-3 block">
            <span className="sr-only">Active project</span>
            <select
              aria-label="Active project"
              className="w-full rounded-lg border border-white/8 bg-[#111114] px-2.5 py-2 text-xs text-zinc-300 outline-none focus:border-violet-400/25"
              onChange={(event) => onSelectProject(event.target.value)}
              value={activeProject?.id || ''}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} · {project.type}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {activeProject && entries.length > 0 ? (
        <div className="flex-1 overflow-y-auto py-2">
          <div className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-zinc-300">
            <FolderIcon className="size-3.5 text-violet-400" />
            <span className="truncate">{activeProject.id}</span>
          </div>
          {entries.map((entry) => {
            const nesting = entry.path.split('/').length
            const EntryIcon = entry.type === 'directory' ? FolderIcon : FileIcon

            return (
              <div
                className="flex items-center gap-2 py-1.5 pr-3 text-xs text-zinc-500"
                key={entry.path}
                style={{ paddingLeft: `${14 + nesting * 14}px` }}
                title={entry.path}
              >
                <EntryIcon className="size-3.5 shrink-0" />
                <span className="truncate">{entry.path.split('/').at(-1)}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-full bg-violet-500/10 blur-xl" />
            <div className="relative flex size-12 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.035] text-zinc-500">
              <FolderIcon className="size-5" />
            </div>
          </div>
          <h2 className="text-sm font-medium text-zinc-300">
            {isLoading
              ? 'Checking projects'
              : activeProject
                ? 'Project is empty'
                : 'No generated projects'}
          </h2>
          <p className="mt-2 max-w-40 text-xs leading-5 text-zinc-600">
            {workspaceState === 'unavailable' || projectsState === 'unavailable'
              ? 'The project workspace could not be reached.'
              : 'Approve an AI development plan to generate a project.'}
          </p>
        </div>
      )}

      {activeProject ? (
        <ProjectCommands
          key={activeProject.id}
          onCommandFinished={() => setRefreshVersion((current) => current + 1)}
          previewStatus={previewStatus}
          project={activeProject}
        />
      ) : null}

      {activeProject ? (
        <VersionHistory
          onChanged={() => setRefreshVersion((current) => current + 1)}
          previewStatus={previewStatus}
          project={activeProject}
        />
      ) : null}

      <div className="border-t border-white/8 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/8 px-3 py-2.5 text-[11px] text-zinc-600">
          <FileIcon className="size-3.5" />
          {activeProject
            ? `${activeProject.type} · active`
            : isLoading
              ? 'Loading workspace'
              : 'Waiting for approved plan'}
        </div>
      </div>
    </aside>
  )
}

export default FileExplorer
