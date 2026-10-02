# Local Development Mode

## Status and scope

This document records the Local Development Mode architecture and the
foundation implemented through Phase 11. Directory authorization, VS Code
integration, managed cloud sandboxes, and backend-service previews remain
future work.

## Product goal

Local Development Mode will let a user select or create a project directory on
their own computer and authorize the AI Website Builder to develop a normal
software project inside that directory.

A typical workflow will be:

1. The user creates a new project and selects Local Mode.
2. The user chooses or creates an authorized project directory.
3. The user describes the website they want to build.
4. The Builder analyzes the request and creates or edits project files within
   the authorized directory.
5. The Builder installs required project dependencies under controlled command
   policies.
6. The Builder runs the project's development server, reads errors, and applies
   targeted fixes.
7. The Builder displays the running project in Live Preview.
8. Later instructions update only the relevant existing files and refresh the
   preview.

## Real project files and user ownership

Projects created in Local Mode must be ordinary development projects. They must
not require the AI Website Builder to remain editable or runnable.

Users must be able to:

- open projects in VS Code or another editor;
- edit the same files manually;
- use Git and push projects to services such as GitHub;
- deploy projects independently;
- move project folders; and
- continue development without the Builder.

The Builder must avoid proprietary project formats that unnecessarily lock a
generated website into the platform.

A generated full-stack project may use a structure such as:

```text
travel-anchor/
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.jsx
│   └── package.json
└── backend/
    ├── src/
    └── package.json
```

This generated backend is separate from the AI Website Builder backend.

## Workspace boundary

Local Mode must never grant the AI unrestricted access to the user's computer.
Every local workspace must begin with a directory explicitly authorized by the
user.

All future file and command tools must resolve and validate paths against the
authorized workspace root. They must prevent absolute-path escapes, `..` path
traversal, symlink or junction escapes, and equivalent filesystem boundary
bypasses.

An authorized workspace will conceptually contain tools such as:

```text
Authorized project directory
        ↓
Workspace boundary
        ↓
listFiles / readFile / writeFile / editFile / searchCode / runCommand
```

Access to a different directory will require separate explicit authorization.

## Workspace abstraction

Higher-level AI planning and coding tools must not depend directly on one
filesystem or execution environment. They should operate through a common
workspace abstraction.

```text
AI orchestrator
      ↓
WorkspaceService
      ├── LocalWorkspaceProvider
      └── SandboxWorkspaceProvider
```

`LocalWorkspaceProvider` will work with a user-authorized directory on the
user's computer. `SandboxWorkspaceProvider` will support a future managed,
isolated Cloud Mode workspace.

The providers may use different storage, process, permission, and lifecycle
mechanisms while exposing consistent higher-level workspace operations.

The provider interface should eventually cover capabilities such as:

- listing, reading, creating, and editing project files;
- searching project content;
- watching for external file changes;
- starting and stopping controlled project processes;
- running allowed development commands;
- collecting bounded command output and runtime errors; and
- exposing preview connection information.

The concrete interface should be designed when the coding-tools and workspace
phases begin. It must not be implemented prematurely during Phase 1.

## VS Code interoperability

Local Mode will eventually provide an action such as **Open in VS Code**. The
Builder and VS Code must operate on the same authorized project directory. The
Builder must not create a hidden working copy for Local Mode.

AI edits must be immediately visible in VS Code. Manual edits made in VS Code
should eventually be detected through filesystem watching so the Builder can
refresh its project understanding without overwriting user work.

VS Code integration is optional interoperability. Generated projects must also
work with other editors and normal command-line development tools.

## Controlled command execution

Local Mode will eventually run common project commands such as `npm install`,
`npm run dev`, and `npm run build`. It must not expose unrestricted shell access
to the AI.

The future execution layer must include:

- workspace-scoped working directories;
- explicit command policies;
- path and executable validation;
- process timeouts and lifecycle management;
- output-size limits;
- environment and secret isolation;
- resource controls where practical; and
- user approval for sensitive operations when appropriate.

Generated code and its commands must be treated as untrusted. Builder secrets
must never be inherited by generated project processes.

## Local and Cloud modes

The architecture must support both execution models without duplicating the
higher-level AI development workflow.

```text
AI Website Builder
        ├── Local Mode
        │     └── User-authorized local project directory
        └── Cloud Mode
              └── Managed isolated sandbox or workspace

Both modes
        ↓
WorkspaceService
        ↓
AI planning and coding tools
```

Local Mode enables normal filesystem and editor workflows. Cloud Mode will
enable managed browser-based development in an isolated environment. The same
AI orchestrator should work with either workspace provider.

## Phase 5 foundation

Phase 5 introduces the provider-neutral coding-tool contract and a managed local
provider rooted at the configured workspace boundary. The initial tools are:

- `listFiles()`
- `readFile()`
- `writeFile()`
- `editFile()`
- `searchCode()`

All tool paths are relative to the configured workspace root. The local
provider rejects absolute paths, parent traversal, symlinks, and junctions. It
also limits file sizes, search result counts, and file-list result counts.

This is an internal managed workspace rather than the complete Local Mode user
authorization flow. Project creation, directory selection, filesystem watching,
command execution, and VS Code integration remain in later phases. The
`WorkspaceProvider` interface allows a future authorized local provider or
sandbox provider to implement the same higher-level operations.

## Earlier phase boundaries

For Phase 1:

- preserve the existing separate Builder frontend and backend;
- keep future workspace code provider-independent;
- do not assume generated projects exist only in cloud storage;
- do not implement local filesystem permissions or file tools;
- do not implement VS Code integration or filesystem watching;
- do not implement unrestricted or controlled shell execution; and
- do not implement Local or Cloud workspace providers yet.

These capabilities must be introduced in their appropriate roadmap phases and
reviewed against the security requirements before they can execute user project
code or access local files.

## Phase 6 project generation

Phase 6 turns an approved development plan into a normal source-code project
inside the managed workspace. A plan receives a server-side ID and version when
it is generated. Approval records the exact plan fingerprint. Regenerating the
plan invalidates its earlier approval, and project generation rejects plans that
are missing, changed, or unapproved.

Generated projects use this structure:

```text
workspace/
└── project-name/
    ├── .ai-builder/
    │   └── project.json
    ├── frontend/
    │   ├── src/
    │   └── package.json
    ├── backend/             # full-stack projects only
    │   ├── src/
    │   └── package.json
    ├── package.json
    ├── README.md
    └── .gitignore
```

The `.ai-builder/project.json` file stores small, versioned Builder metadata.
The application code does not depend on it and remains independently editable
and deployable. Metadata currently uses JSON files so it can later move behind
a database-backed repository without changing project-generation behavior.

Every generated file is written through `WorkspaceService`. Once a project is
selected, coding tools receive a provider rooted at that project rather than at
the whole workspace. Paths cannot reach sibling projects, Builder source, or
the protected metadata directory.

Phase 6 only writes source files. It does not install dependencies, run project
commands, start generated development servers, or provide a live preview.

## Phase 7 safe command execution

Phase 7 adds a provider-level `runCommand()` capability and exposes two finite
project actions:

- **Install dependencies** runs npm install with lifecycle scripts, audit, fund,
  and update-notifier behavior disabled.
- **Build frontend** runs the generated project's frontend production build.

The browser shows the proposed action and requires a separate **Confirm run**
step. The API also rejects requests that do not carry explicit confirmation.
The server maps action IDs to fixed executables and arguments; callers cannot
submit command text, extra arguments, a working directory, or shell syntax.

Every command runs with its working directory fixed to the selected project.
The project-scoped `WorkspaceService` creates the provider, so a manipulated
project ID cannot select the Builder source tree or a sibling project. The
process receives an allowlisted environment that excludes Builder secrets such
as AI provider credentials. Execution uses no shell and enforces time and
combined-output limits. Only one command may run per project at a time, and a
timed-out or output-limited process tree is terminated.

Dependency installation uses `--ignore-scripts` because package lifecycle
scripts execute arbitrary code. A production build necessarily evaluates the
generated project's build configuration and source. Local execution therefore
still requires user confirmation and is not equivalent to an operating-system
or container sandbox. A managed sandbox provider and stronger resource
isolation remain future Cloud Mode work.

Phase 7 does not start persistent development servers, expose a general
terminal, or implement Live Preview. Those capabilities remain within later
roadmap phases.

## Phase 8 Live Preview

Phase 8 adds a managed frontend development-server lifecycle through the same
project-scoped `WorkspaceService` abstraction used by coding tools and finite
commands. Starting a preview maps to the generated project's installed Vite CLI
and launches it directly through Node. The server supplies the frontend root,
host, and port arguments, uses no shell, and fixes the process working directory
to the selected project.

Preview servers bind only to `127.0.0.1` and receive an available port from the
controlled range `5200–5299`. The backend waits for an HTTP response before it
reports the preview as running. Startup failures and bounded process output are
available through the preview status endpoint. A preview that cannot become
ready within 15 seconds is terminated.

The process environment uses the Phase 7 allowlist and does not inherit Builder
AI credentials. Combined output is capped at 512 KiB. Exceeding the limit
terminates the process tree. The backend stops managed preview processes during
graceful shutdown. A shared project-process registry prevents dependency
installation or production builds from running while that project's preview is
active.

Starting a preview requires a separate confirmation in the interface and a
confirmed API request because generated development configuration executes as
code. The interface can start, stop, refresh, and display the frontend in a
sandboxed iframe. Desktop, tablet, and mobile frame widths are available for
manual inspection.

Phase 8 does not expose a general terminal, start a generated full-stack
backend, provide automatic responsive analysis, take screenshots, or inspect
the rendered result with AI. Preview state and port reservations are currently
kept in backend memory. Strong operating-system or container isolation remains
future Cloud Mode work.

## Phase 9 existing-code editing

Phase 9 lets the configured AI provider make targeted changes to the active
generated project. An edit uses two provider-neutral structured requests. The
first receives project metadata and a file manifest, then selects at most 12
relevant files and optional literal search terms. The Builder searches and
reads only that bounded set. The second request receives those file contents
and proposes validated create or exact-text replace operations.

All reads, searches, and writes use the project-scoped `WorkspaceService`.
Proposed paths must be portable project-relative paths. Traversal, absolute
paths, Builder metadata, Git data, dependencies, and build output are rejected.
An existing file can be changed only when it was included in the inspected
context. Every replacement and output size is checked in memory before the
first write, so an invalid later operation does not partially apply an edit.
Project source is marked as untrusted data in both AI stages.

The edit response records its changed paths, provider and model identifiers,
and the inspected-file list. Successful edits update project metadata and
refresh the File Explorer. A running Vite preview may remain active so its HMR
server can observe file writes; the preview iframe is also refreshed. The
project process registry blocks concurrent edits, dependency installation, and
production builds while an edit is active.

Phase 9 does not automatically install dependencies, run builds, execute tests,
or start previews. Those remain explicit confirmed actions. It also does not
yet add Git recovery, semantic indexing, visual verification, or responsive
reasoning.

## Phase 10 responsive intelligence

Phase 10 adds a project-scoped responsive source audit. The audit reads only
frontend source files through `WorkspaceService` and evaluates common risks
against seven standard viewport profiles: 1920×1080, 1440×900, 1024×768,
768×1024, 430×932, 390×844, and 360×800.

It reports missing viewport metadata, unbounded images, large fixed widths,
fixed multi-column grids, Tailwind fixed-width and grid utilities, and absolute
positioning that needs breakpoint review. Findings identify source path, line
when available, severity, and the affected viewport profiles. The Live Preview
panel can run the audit and show the highest-priority findings without starting
the generated project or running an unrestricted command.

The Phase 10 audit is intentionally static: it does not claim to verify the
rendered page, take screenshots, or inspect pixels. Rendered visual comparison,
browser automation, and AI-directed visual corrections remain Phase 13 work.

## Phase 11 screenshot references

Phase 11 adds screenshot-reference handling for an active generated project.
The interface accepts PNG, JPEG, and WebP images up to 5 MiB. Uploads are sent
as raw image bodies, then the backend verifies the actual file signature,
declared media type, width, height, and pixel count before storing anything.

Reference images are written only through the workspace abstraction under the
project's protected `.ai-builder/references/` directory. The Builder assigns a
random storage identifier and never uses a supplied filename as a filesystem
path. Public APIs expose only safe reference metadata and a project-scoped
asset endpoint; they do not expose internal storage paths. Coding tools remain
unable to read or write `.ai-builder` metadata.

The current phase stores and displays references so a project can retain its
design inputs. It does not yet send images to an AI provider, infer layouts,
or generate code from a screenshot. Those provider-enabled visual reasoning
steps remain future work.

## Phase 12 Figma references

Phase 12 adds an optional Figma URL to the planning flow. The backend validates
only `https://www.figma.com/design/...` and `https://www.figma.com/file/...`
URLs, then uses an optional backend-only `FIGMA_ACCESS_TOKEN` to request a
bounded Figma file summary. It extracts visible design structure such as frames,
components, node types, and text examples, and supplies that summary to the AI
planning request as untrusted reference data. The full Figma response and token
are never sent to the browser.

The returned plan and the generated project's originating-plan metadata retain
only the safe reference URL, file key, optional node identifier, design name,
and bounded summary. A Figma URL is optional; ordinary text planning continues
without a Figma token. This phase plans from Figma structure. Pixel-level visual
comparison and AI-directed render corrections remain Phase 13 work.

## Phase 13 visual verification

Phase 13 adds a controlled Playwright Chromium check for an already-running
Builder preview. It never accepts a user-supplied URL and does not start a
generated-project command: the preview must have been started through the
existing confirmed preview workflow. The checker loads only that local preview
at desktop (1440×1080), tablet (768×1024), and mobile (390×844) sizes.

For each viewport it captures a PNG with a 5 MiB limit, checks document-level
and element-level horizontal overflow, records browser console errors, and
stores screenshots and check metadata under protected project `.ai-builder`
paths through `WorkspaceService`. The interface reports the result after a
user clicks **Run visual check**. This is deterministic browser diagnostics;
AI-directed visual comparison against reference images and automatic corrective
edits are deferred to a later enhancement.

## Phase 14 backend and CMS generation

Phase 14 extends an approved full-stack plan with an optional backend-generation
specification. Plans can select `express` for a Node.js API scaffold or `strapi`
for a standard Strapi project scaffold, and can define a bounded list of content
types and primitive fields. The generator validates this specification before
writing files and creates all files only through `WorkspaceService`.

Express projects receive project-relative content-type definitions and read-only
starter routes. Strapi projects receive a normal `backend/` project with its
own package manifest, environment example, configuration, and content-type
schema files. The Builder never installs those dependencies, initializes a
database, creates credentials, or starts a generated backend in this phase.

## Phase 15 database and authentication generation

Phase 15 lets approved full-stack Express plans define a SQLite, PostgreSQL, or
MySQL data model and optional role-based authentication. The generated project
uses normal Prisma schema files, an application database client, and a backend
environment example. Authentication adds a Prisma `User` model, `bcryptjs`
password hashing, signed JWT routes, and reusable role-permission middleware.

All database URLs and JWT secrets remain empty placeholders in the generated
`.env.example`; neither is exposed to the Builder frontend. Prisma, database
drivers, and authentication packages are listed only in the generated backend
manifest. They are not installed by the Builder, no migration is applied, and
no database or generated backend is executed automatically.

## Phase 16 Git versioning

Phase 16 initializes a local Git repository for each newly generated project.
The repository is configured with a project-local Builder identity and receives
an initial-generation commit. Successful AI edits create an `AI edit` snapshot
when the project has a usable repository. Reference images and visual-check
screenshots stay excluded from Git through the generated `.gitignore`.

The project API exposes a bounded version list, file-stat comparison against
the current version, manual snapshots, and restore. Git commands are fixed
argument lists executed without a shell through the project-scoped
`WorkspaceService`; the Builder exposes no remote, pull, push, fetch, branch,
credential, or arbitrary Git command API. Restore requires explicit UI and API
confirmation, creates a snapshot of current changes first, and commits the
restored result as a new recoverable version.

## Phase 17 export

Phase 17 provides a direct ZIP export for the active generated project. The
backend enumerates and reads project files only through the project-scoped
`WorkspaceService`, then streams the archive to the browser. Export includes
normal editable source and `.env.example` files. It excludes `.git`,
`.ai-builder`, dependencies, build output, real `.env` variants, and uses
bounded file-count and total-size limits.

No hosting provider receives a project, source code, environment value, or Git
credential. Generated projects include `DEPLOYMENT.md` with build, environment,
and export guidance so they can be deployed independently of the Builder.
