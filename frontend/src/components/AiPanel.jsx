import { useEffect, useState } from 'react'
import {
  approveAIPlan,
  createAIPlan,
  createProject,
  editProject,
  getAIStatus,
  sendAIMessage,
} from '../services/api.js'
import { SendIcon, SparklesIcon } from './Icons.jsx'
import PlanView from './PlanView.jsx'
import ReferenceImages from './ReferenceImages.jsx'

const initialProviderStatus = {
  configured: false,
  model: null,
  provider: null,
  state: 'checking',
}

function AiPanel({
  activeProject,
  onProjectCreated,
  onProjectEdited,
  onReferenceUploaded,
  projectRevision,
}) {
  const [error, setError] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [lastPlanRequest, setLastPlanRequest] = useState('')
  const [editMessages, setEditMessages] = useState([])
  const [figmaUrl, setFigmaUrl] = useState('')
  const [messages, setMessages] = useState([])
  const [mode, setMode] = useState('plan')
  const [planResult, setPlanResult] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [providerStatus, setProviderStatus] = useState(initialProviderStatus)

  useEffect(() => {
    let isCurrent = true

    getAIStatus()
      .then((status) => {
        if (isCurrent) {
          setProviderStatus({ ...status, state: 'loaded' })
        }
      })
      .catch(() => {
        if (isCurrent) {
          setProviderStatus({
            ...initialProviderStatus,
            state: 'unavailable',
          })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const isConfigured = providerStatus.configured
  const canSend = Boolean(
    isConfigured &&
      prompt.trim() &&
      !isSending &&
      (mode !== 'edit' || activeProject),
  )
  const providerLabel = providerStatus.provider
    ? `${providerStatus.provider} · ${providerStatus.model || 'model required'}`
    : providerStatus.state === 'checking'
      ? 'Checking provider'
      : 'Not configured'

  async function requestPlan(projectRequest) {
    setError('')
    setIsSending(true)

    try {
      const result = await createAIPlan(projectRequest, planResult, figmaUrl.trim())
      setLastPlanRequest(projectRequest)
      setPlanResult(result)
      setPrompt('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSending(false)
    }
  }

  async function sendChatMessage(message) {
    const userMessage = {
      content: message,
      id: `${Date.now()}-user`,
      role: 'user',
    }

    setError('')
    setIsSending(true)
    setMessages((current) => [...current, userMessage])
    setPrompt('')

    try {
      const result = await sendAIMessage(message)

      setMessages((current) => [
        ...current,
        {
          content: result.message,
          id: `${Date.now()}-assistant`,
          role: 'assistant',
        },
      ])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSending(false)
    }
  }

  async function sendEditRequest(message) {
    if (!activeProject) {
      return
    }

    const projectId = activeProject.id
    const userMessage = {
      content: message,
      id: `${Date.now()}-edit-user`,
      projectId,
      role: 'user',
    }

    setError('')
    setIsSending(true)
    setEditMessages((current) => [...current, userMessage])
    setPrompt('')

    try {
      const result = await editProject(projectId, message)

      setEditMessages((current) => [
        ...current,
        {
          changes: result.changes,
          content: result.summary,
          id: `${Date.now()}-edit-assistant`,
          projectId,
          role: 'assistant',
        },
      ])
      onProjectEdited(result)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSending(false)
    }
  }

  async function approveCurrentPlan() {
    if (!planResult || isApproving) {
      return
    }

    setError('')
    setIsApproving(true)

    try {
      const approval = await approveAIPlan(
        planResult.planId,
        planResult.version,
      )

      setPlanResult((current) =>
        current?.planId === approval.planId
          ? { ...current, ...approval }
          : current,
      )
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsApproving(false)
    }
  }

  async function generateProject(projectName) {
    if (!planResult?.approved || isCreatingProject) {
      return
    }

    setError('')
    setIsCreatingProject(true)

    try {
      const project = await createProject(
        projectName,
        planResult.planId,
        planResult.version,
      )

      setPlanResult((current) =>
        current?.planId === planResult.planId
          ? { ...current, generatedProject: project }
          : current,
      )
      onProjectCreated(project)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsCreatingProject(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const message = prompt.trim()

    if (!isConfigured || !message || isSending) {
      return
    }

    if (mode === 'plan') {
      await requestPlan(message)
      return
    }

    if (mode === 'edit') {
      await sendEditRequest(message)
      return
    }

    await sendChatMessage(message)
  }

  function handlePromptKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()

      if (canSend) {
        event.currentTarget.form?.requestSubmit()
      }
    }
  }

  function changeMode(nextMode) {
    setError('')
    setMode(nextMode)
  }


  const visibleMessages =
    mode === 'edit'
      ? editMessages.filter((message) => message.projectId === activeProject?.id)
      : messages

  return (
    <aside className="flex min-h-[560px] flex-col border-t border-white/8 bg-[#0e0e11] md:col-span-2 xl:col-span-1 xl:min-h-0 xl:border-t-0 xl:border-l">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/8 px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          <SparklesIcon className="size-3.5 shrink-0 text-violet-400" />
          <span className="truncate">SKY AI</span>
        </div>

        <div className="flex items-center rounded-lg border border-white/8 bg-black/15 p-0.5">
          {['plan', 'edit', 'chat'].map((item) => (
            <button
              aria-pressed={mode === item}
              className={`rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition-colors ${
                mode === item
                  ? 'bg-white/[0.08] text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
              key={item}
              onClick={() => changeMode(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <span
          className={`max-w-24 truncate rounded-full border px-2 py-0.5 text-[8px] font-medium uppercase tracking-wider ${
            isConfigured
              ? 'border-emerald-400/15 bg-emerald-400/5 text-emerald-300'
              : 'border-white/8 text-zinc-600'
          }`}
          title={providerLabel}
        >
          {providerLabel}
        </span>
      </div>

      <div
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        {mode === 'plan' ? (
          planResult ? (
            <PlanView
              isApproving={isApproving}
              isCreatingProject={isCreatingProject}
              isRegenerating={isSending}
              key={planResult.planId}
              onApprove={approveCurrentPlan}
              onCreateProject={generateProject}
              onRegenerate={() => requestPlan(lastPlanRequest)}
              request={lastPlanRequest}
              result={planResult}
            />
          ) : (
            <EmptyState
              description={
                isConfigured
                  ? 'Describe a project to create a structured, reviewable development plan.'
                  : 'Add provider credentials and a model to the backend environment to begin.'
              }
              title="Plan your next build"
            />
          )
        ) : visibleMessages.length === 0 ? (
          <EmptyState
            description={
              mode === 'edit' && !activeProject
                ? 'Generate or select a project before requesting source-code changes.'
                : isConfigured && mode === 'edit'
                  ? `Describe a targeted change for ${activeProject.name}. Relevant files will be selected before edits are applied.`
                  : isConfigured
                    ? 'Send a stateless message through the configured AI provider.'
                : 'Add provider credentials and a model to the backend environment to begin.'
            }
            title={mode === 'edit' ? 'Edit the active project' : 'What would you like to build?'}
          />
        ) : (
          <div className="space-y-4 px-4 py-5">
            {visibleMessages.map((message) => (
              <div
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
                key={message.id}
              >
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-3 text-xs leading-5 ${
                    message.role === 'user'
                      ? 'rounded-br-md bg-violet-500/15 text-violet-100'
                      : 'rounded-bl-md border border-white/8 bg-white/[0.035] text-zinc-300'
                  }`}
                >
                  {message.content}
                  {message.changes?.length ? (
                    <ul className="mt-2 space-y-1 border-t border-white/8 pt-2 text-[10px] text-zinc-500">
                      {message.changes.map((change) => (
                        <li key={change.path}>
                          {change.action} · {change.path}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {isSending ? (
          <div className="flex items-center gap-2 px-4 pb-4 text-xs text-zinc-600">
            <span className="size-1.5 animate-pulse rounded-full bg-violet-400" />
            {mode === 'plan'
              ? 'Creating a development plan...'
              : mode === 'edit'
                ? 'Inspecting and editing project files...'
                : 'Waiting for the provider...'}
          </div>
        ) : null}
      </div>

      <form className="border-t border-white/8 p-3" onSubmit={handleSubmit}>
        {error ? (
          <p
            className="mb-2 rounded-lg border border-red-400/15 bg-red-400/5 px-3 py-2 text-xs leading-5 text-red-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="rounded-xl border border-white/10 bg-[#111114] shadow-lg shadow-black/10 focus-within:border-violet-400/25">
          {mode === 'plan' ? (
            <label className="flex items-center gap-2 border-b border-white/8 px-3.5 py-2 text-[10px] text-zinc-500">
              <span className="shrink-0 font-medium uppercase tracking-[0.12em] text-zinc-600">Figma</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-[11px] text-zinc-400 outline-none placeholder:text-zinc-700"
                maxLength={2000}
                onChange={(event) => setFigmaUrl(event.target.value)}
                placeholder="Optional Figma design URL"
                type="url"
                value={figmaUrl}
              />
            </label>
          ) : null}
          <label className="sr-only" htmlFor="ai-prompt">
            {mode === 'plan'
              ? 'Describe the project to plan'
              : mode === 'edit'
                ? 'Describe a change to the active project'
                : 'Ask SKY AI'}
          </label>
          <textarea
            className="min-h-24 w-full resize-none bg-transparent px-3.5 pt-3.5 text-sm leading-5 text-zinc-300 outline-none placeholder:text-zinc-700"
            id="ai-prompt"
            maxLength={2000}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handlePromptKeyDown}
            placeholder={
              mode === 'plan'
                ? 'Describe the website you want to plan...'
                : mode === 'edit'
                  ? activeProject
                    ? `Change ${activeProject.name}...`
                    : 'Select a project to edit...'
                  : 'Ask SKY AI...'
            }
            value={prompt}
          />

          <div className="flex items-center justify-between gap-3 px-2.5 pb-2.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-700">
                {prompt.length.toLocaleString()} / 2,000
              </span>
            </div>

            <button
              aria-label={
                mode === 'plan'
                  ? 'Create plan'
                  : mode === 'edit'
                    ? 'Edit active project'
                    : 'Send prompt'
              }
              className={`flex size-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed ${
                canSend
                  ? 'bg-violet-500 text-white hover:bg-violet-400'
                  : 'bg-violet-500/15 text-violet-300/40'
              }`}
              disabled={!canSend}
              title={
                isConfigured
                  ? mode === 'plan'
                    ? 'Create development plan'
                    : mode === 'edit'
                      ? activeProject
                        ? 'Inspect and edit the active project'
                        : 'Select a project to edit'
                      : 'Send message'
                  : 'Configure an AI provider in the backend environment'
              }
              type="submit"
            >
              <SendIcon />
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-zinc-700">
          {mode === 'plan'
            ? 'Only an approved plan can generate files. Project commands require confirmation.'
            : mode === 'edit'
              ? 'Edits use targeted project context. Builds remain a confirmed project command.'
              : 'Chat messages are stateless.'}
        </p>
        <ReferenceImages
          activeProject={activeProject}
          onUploaded={onReferenceUploaded}
          projectRevision={projectRevision}
        />
      </form>
    </aside>
  )
}

function EmptyState({ description, title }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-7 py-10 text-center">
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/[0.07] text-violet-300">
        <SparklesIcon className="size-5" />
      </div>
      <h2 className="text-sm font-medium text-zinc-200">{title}</h2>
      <p className="mt-2 max-w-64 text-xs leading-5 text-zinc-600">
        {description}
      </p>
    </div>
  )
}

export default AiPanel
