import { CodeIcon, ExternalLinkIcon, MoonIcon, SparklesIcon, SunIcon } from './Icons.jsx'
import { getProjectExportUrl } from '../services/api.js'

const statusStyles = {
  checking: {
    dot: 'animate-pulse bg-amber-400',
    label: 'Connecting',
    text: 'text-amber-200',
  },
  connected: {
    dot: 'bg-emerald-400',
    label: 'API online',
    text: 'text-emerald-200',
  },
  disconnected: {
    dot: 'bg-red-400',
    label: 'API offline',
    text: 'text-red-200',
  },
}

function Header({ activeProject, backendStatus, onOpenPreview, onToggleTheme, projectName, theme }) {
  const status = statusStyles[backendStatus] || statusStyles.disconnected

  return (
    <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-white/8 bg-[#0d0d10] px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/12 text-violet-300 shadow-[0_0_24px_rgba(139,92,246,0.08)]">
          <SparklesIcon className="size-[18px]" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-100 sm:text-[15px]">
              SKY AI Website Builder
            </h1>
            <span className="hidden rounded-md border border-white/8 bg-white/[0.035] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500 sm:inline">
              Alpha
            </span>
          </div>
          <p className="truncate text-[11px] text-zinc-500">
            {projectName || 'No active project'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`hidden items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] px-2.5 py-1.5 text-[11px] sm:flex ${status.text}`}
          role="status"
        >
          <span className={`size-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </div>

        <button
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="flex size-9 items-center justify-center rounded-lg border border-white/8 bg-white/[0.035] text-zinc-400 hover:border-violet-400/20 hover:text-violet-500"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          type="button"
        >
          {theme === 'dark' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
        </button>

        <button
          className="hidden items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.035] px-3 py-2 text-xs font-medium text-zinc-400 hover:border-violet-400/20 hover:text-zinc-200 sm:flex"
          onClick={onOpenPreview}
          title="Open Live Preview controls"
          type="button"
        >
          <CodeIcon />
          Preview
        </button>
        <a
          className={`flex items-center gap-1.5 rounded-lg border border-violet-400/15 bg-violet-500/10 px-3 py-2 text-xs font-medium ${activeProject ? 'text-violet-200 hover:bg-violet-500/15' : 'pointer-events-none text-violet-300/50'}`}
          href={activeProject ? getProjectExportUrl(activeProject.id) : undefined}
          title={activeProject ? 'Download project source as a ZIP file' : 'Select a project to export'}
        >
          Export
          <ExternalLinkIcon className="size-3.5" />
        </a>
      </div>
    </header>
  )
}

export default Header
