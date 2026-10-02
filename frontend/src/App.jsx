import { useEffect, useState } from 'react'
import AiPanel from './components/AiPanel.jsx'
import FileExplorer from './components/FileExplorer.jsx'
import Header from './components/Header.jsx'
import PreviewPanel from './components/PreviewPanel.jsx'
import { getHealth, getProjects } from './services/api.js'

function App() {
  const [theme, setTheme] = useState(() => {
    return window.localStorage.getItem('sky-ai-theme') === 'light' ? 'light' : 'dark'
  })
  const [backendStatus, setBackendStatus] = useState('checking')
  const [activeProjectId, setActiveProjectId] = useState('')
  const [projects, setProjects] = useState([])
  const [projectsState, setProjectsState] = useState('loading')
  const [previewStatus, setPreviewStatus] = useState('stopped')
  const [projectRevision, setProjectRevision] = useState(0)

  useEffect(() => {
    let isCurrent = true

    getHealth()
      .then((health) => {
        if (isCurrent) {
          setBackendStatus(health.success ? 'connected' : 'disconnected')
        }
      })
      .catch(() => {
        if (isCurrent) {
          setBackendStatus('disconnected')
        }
      })

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('sky-ai-theme', theme)
  }, [theme])

  useEffect(() => {
    let isCurrent = true

    getProjects()
      .then((availableProjects) => {
        if (isCurrent) {
          setProjects(availableProjects)
          setActiveProjectId((current) => current || availableProjects[0]?.id || '')
          setProjectsState('ready')
        }
      })
      .catch(() => {
        if (isCurrent) {
          setProjectsState('unavailable')
        }
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const activeProject = projects.find(
    (project) => project.id === activeProjectId,
  )

  function handleProjectCreated(project) {
    setProjects((current) => [project, ...current])
    setActiveProjectId(project.id)
    setProjectsState('ready')
  }

  function handleProjectEdited() {
    setProjectRevision((current) => current + 1)
  }

  function handleReferenceUploaded() {
    setProjectRevision((current) => current + 1)
  }

  return (
    <div className={`theme-${theme} flex min-h-screen flex-col bg-[#09090b] text-zinc-100 xl:h-screen xl:overflow-hidden`}>
      <Header
        activeProject={activeProject}
        backendStatus={backendStatus}
        onOpenPreview={() =>
          document
            .getElementById('live-preview')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        projectName={activeProject?.name}
        theme={theme}
      />

      <main className="grid min-h-0 flex-1 grid-cols-1 bg-[#0c0c0f] md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_360px]">
        <FileExplorer
          activeProject={activeProject}
          onSelectProject={setActiveProjectId}
          projects={projects}
          projectsState={projectsState}
          previewStatus={previewStatus}
          projectRevision={projectRevision}
        />
        <PreviewPanel
          activeProject={activeProject}
          key={activeProject?.id || 'no-active-project'}
          onStatusChange={setPreviewStatus}
          projectRevision={projectRevision}
        />
        <AiPanel
          activeProject={activeProject}
          onProjectCreated={handleProjectCreated}
          onProjectEdited={handleProjectEdited}
          onReferenceUploaded={handleReferenceUploaded}
          projectRevision={projectRevision}
        />
      </main>
    </div>
  )
}

export default App
