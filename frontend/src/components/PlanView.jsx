import { useState } from 'react'
import { RefreshIcon } from './Icons.jsx'

const technologyLabels = {
  backend: 'Backend',
  database: 'Database',
  frontend: 'Frontend',
}

function suggestedName(summary) {
  return summary
    .replace(/^(create|build)\s+(a|an|the)?\s*/i, '')
    .split(/\s+/)
    .slice(0, 6)
    .join(' ')
    .slice(0, 60)
}

function PlanView({
  isApproving,
  isCreatingProject,
  isRegenerating,
  onApprove,
  onCreateProject,
  onRegenerate,
  request,
  result,
}) {
  const { plan } = result
  const [projectName, setProjectName] = useState(() => suggestedName(plan.summary))
  const technologies = Object.entries(plan.technology).filter(
    ([, values]) => values.length > 0,
  )

  function handleCreateProject(event) {
    event.preventDefault()
    onCreateProject(projectName.trim())
  }

  return (
    <div className="space-y-5 px-4 py-5">
      <div className="rounded-xl border border-violet-400/15 bg-violet-500/[0.06] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">
              Development plan
            </p>
            <h2 className="mt-2 text-sm font-medium leading-5 text-zinc-100">
              {plan.summary}
            </h2>
          </div>
          <span className="shrink-0 rounded-full border border-white/8 bg-black/15 px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-zinc-400">
            {plan.projectType.replace('-', ' ')}
          </span>
        </div>
        <p className="mt-3 text-[11px] leading-4 text-zinc-500">
          Based on: {request}
        </p>
        {result.designReference ? (
          <p className="mt-2 text-[11px] leading-4 text-violet-200/70">
            Figma reference: {result.designReference.designName} · {result.designReference.summary.frames.length} frames inspected
          </p>
        ) : null}
      </div>

      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Requirements
        </h3>
        <ul className="mt-2 space-y-2">
          {plan.requirements.map((requirement) => (
            <li
              className="flex gap-2 text-xs leading-5 text-zinc-300"
              key={requirement}
            >
              <span className="mt-2 size-1 shrink-0 rounded-full bg-violet-400" />
              {requirement}
            </li>
          ))}
        </ul>
      </section>

      {technologies.length > 0 ? (
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Technology
          </h3>
          <div className="mt-2 space-y-2">
            {technologies.map(([category, values]) => (
              <div className="flex flex-wrap items-center gap-1.5" key={category}>
                <span className="mr-1 text-[10px] text-zinc-600">
                  {technologyLabels[category]}
                </span>
                {values.map((value) => (
                  <span
                    className="rounded-md border border-white/8 bg-white/[0.035] px-2 py-1 text-[10px] text-zinc-400"
                    key={value}
                  >
                    {value}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {plan.backendGeneration ? (
        <section className="rounded-xl border border-white/8 bg-white/[0.025] p-3.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Backend generation
          </h3>
          <p className="mt-1.5 text-[11px] text-zinc-400">
            {plan.backendGeneration.provider === 'strapi' ? 'Strapi CMS scaffold' : 'Node.js and Express API scaffold'}
          </p>
          {plan.backendGeneration.contentTypes.length ? (
            <p className="mt-1 text-[10px] leading-4 text-zinc-600">
              Content types: {plan.backendGeneration.contentTypes.map((contentType) => contentType.name).join(', ')}
            </p>
          ) : null}
        </section>
      ) : null}

      {plan.databaseGeneration ? (
        <section className="rounded-xl border border-white/8 bg-white/[0.025] p-3.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Data and access
          </h3>
          <p className="mt-1.5 text-[11px] text-zinc-400">
            {plan.databaseGeneration.provider} database · {plan.databaseGeneration.entities.map((entity) => entity.name).join(', ') || 'No application entities'}
          </p>
          {plan.authentication ? (
            <p className="mt-1 text-[10px] leading-4 text-zinc-600">
              Authentication roles: {plan.authentication.roles.map((role) => role.name).join(', ')}
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Implementation steps
        </h3>
        <ol className="mt-3 space-y-3">
          {plan.steps.map((step, index) => (
            <li className="flex gap-3" key={step.id}>
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-[10px] font-medium text-zinc-400">
                {index + 1}
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-xs font-medium text-zinc-200">{step.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-zinc-600">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {plan.assumptions.length > 0 ? (
        <section className="rounded-xl border border-white/8 bg-white/[0.025] p-3.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Assumptions
          </h3>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-4 text-zinc-500">
            {plan.assumptions.map((assumption) => (
              <li key={assumption}>• {assumption}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {plan.questions.length > 0 ? (
        <section className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/80">
            Questions before implementation
          </h3>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-4 text-zinc-400">
            {plan.questions.map((question) => (
              <li key={question}>• {question}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-violet-400/15 bg-violet-500/[0.04] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">
              Plan approval
            </h3>
            <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">
              {result.approved
                ? 'This exact plan version is approved for project generation.'
                : 'Review the plan before allowing it to create project files.'}
            </p>
          </div>
          <span className="rounded-full border border-white/8 px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-zinc-500">
            v{result.version}
          </span>
        </div>

        {!result.approved ? (
          <button
            className="mt-3 w-full rounded-lg bg-violet-500 px-3 py-2 text-xs font-medium text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isApproving || isRegenerating}
            onClick={onApprove}
            type="button"
          >
            {isApproving ? 'Approving plan...' : 'Approve plan'}
          </button>
        ) : result.generatedProject ? (
          <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2.5 text-xs text-emerald-300">
            Project created: {result.generatedProject.name}
          </div>
        ) : (
          <form className="mt-3 space-y-2" onSubmit={handleCreateProject}>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-medium text-zinc-500">
                Project name
              </span>
              <input
                className="w-full rounded-lg border border-white/10 bg-[#0d0d10] px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-violet-400/25"
                maxLength={80}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="My website"
                value={projectName}
              />
            </label>
            <button
              className="w-full rounded-lg bg-violet-500 px-3 py-2 text-xs font-medium text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!projectName.trim() || isCreatingProject}
              type="submit"
            >
              {isCreatingProject ? 'Generating project...' : 'Generate project'}
            </button>
          </form>
        )}
      </section>

      <div className="flex items-center justify-between border-t border-white/8 pt-4">
        <p className="text-[10px] text-zinc-600">
          {result.provider} · {result.model}
        </p>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.035] px-2.5 py-1.5 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRegenerating}
          onClick={onRegenerate}
          type="button"
        >
          <RefreshIcon className={`size-3 ${isRegenerating ? 'animate-spin' : ''}`} />
          Regenerate
        </button>
      </div>
    </div>
  )
}

export default PlanView
