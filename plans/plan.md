# Fold AI — Project Plan

> **Fold AI** — A web UI + automation layer over OpenCode that runs a virtual company of AI agents on your local machine.

---

## 1. Vision

Fold AI borrows two ideas and merges them:

| From | Concept |
|------|---------|
| **OpenChamber** | UI layer over OpenCode — manages sessions, proxies API calls, provides a rich web dashboard |
| **Paperclip AI** | Virtual company model — employees (AI personas), projects, tasks with lifecycle, filing cabinet |

The key difference from both: **Fold AI uses your existing OpenCode agents, skills, and config.** No reinventing the agent system — we wrap what already works.

---

## 2. Core Concepts

### 2.1 Company
A "company" is a named workspace containing employees, projects, tasks, and a filing cabinet. You can have multiple companies (e.g., "My SaaS Startup", "Consulting LLC").

### 2.2 Employees (AI Personas)
Employees are personas mapped to OpenCode agent configurations. Each employee has:
- A name, role, and description (the "persona")
- A reference to an OpenCode agent (e.g., `OpenCoder`, `OpenAgent`)
- Optional skills to load (from `~/.config/opencode/skills/`)
- A model preference (which LLM provider/model to use)

Employees are the "staff" that pick up and execute tasks.

### 2.3 Projects
Projects are links to local directories on your machine. Each project has:
- A name and description
- A local path (e.g., `/home/jhatfield/Documents/gitrepos/my-app`)
- Optional context files (project-specific instructions for agents)

### 2.4 Tasks
Tasks are units of work assigned to a project. Lifecycle:

```
planned → todo → in_progress → for_review → complete
```

- **planned**: Drafted but not yet ready to run
- **todo**: Ready — flagged for pickup by the task runner
- **in_progress**: An employee is actively working on it (OpenCode session running)
- **for_review**: Work is done, waiting for human review
- **complete**: Reviewed and accepted

Additional states: `blocked` (waiting on dependency), `cancelled`.

### 2.5 Filing Cabinet
A store of markdown files organized by:
- **Project files**: Plans, specs, notes tied to a specific project
- **Task files**: Output/artifacts from task execution
- **Company files**: Central policies, coding standards, agent instructions that apply company-wide

Files are stored as flat `.md` files on disk, indexed by a manifest.

### 2.6 Task Runner
The backend process that:
1. Scans for `todo` tasks
2. Finds an available employee whose persona matches the task requirements
3. Spawns an OpenCode session with the employee's agent config
4. Passes the task description + project context + company policies
5. Monitors the session, captures output
6. Moves task to `for_review` when done

---

## 3. Architecture

### 3.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24 (via nvm) |
| Language | TypeScript (strict) |
| Backend | Express 5 |
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| State (UI) | Zustand |
| State (persistence) | Flat JSON files + directories on disk |
| OpenCode integration | Spawn `opencode` as child process, proxy API |
| Package manager | npm (or pnpm) |

### 3.2 Project Structure

```
foldaiAgent/
├── packages/
│   ├── server/              # Express backend
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point
│   │   │   ├── config.ts          # Config loading
│   │   │   ├── routes/
│   │   │   │   ├── companies.ts
│   │   │   │   ├── employees.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── tasks.ts
│   │   │   │   └── cabinet.ts
│   │   │   ├── services/
│   │   │   │   ├── company-service.ts
│   │   │   │   ├── employee-service.ts
│   │   │   │   ├── project-service.ts
│   │   │   │   ├── task-service.ts
│   │   │   │   ├── cabinet-service.ts
│   │   │   │   └── task-runner.ts    # Spawns OpenCode sessions
│   │   │   ├── store/
│   │   │   │   ├── file-store.ts     # Flat-file read/write
│   │   │   │   └── manifest.ts       # Index of all entities
│   │   │   └── opencode/
│   │   │       ├── session.ts        # OpenCode process management
│   │   │       └── proxy.ts          # API proxy to OpenCode
│   │   └── package.json
│   │
│   └── ui/                  # React frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── Company.tsx
│       │   │   ├── Employees.tsx
│       │   │   ├── Projects.tsx
│       │   │   ├── Tasks.tsx
│       │   │   └── Cabinet.tsx
│       │   ├── components/
│       │   ├── stores/        # Zustand stores
│       │   └── api/           # API client
│       └── package.json
│
├── data/                    # Flat-file state (gitignored or committed?)
│   └── companies/
│       └── {company-slug}/
│           ├── company.json
│           ├── employees.json
│           ├── projects.json
│           ├── tasks.json
│           └── cabinet/
│               ├── manifest.json
│               └── files/
│                   ├── company-policy.md
│                   ├── coding-standards.md
│                   └── ...
│
├── plan.md                  # This file
├── package.json             # Root workspace config
└── tsconfig.json
```

### 3.3 Data Flow

```
User (Browser)
    │
    ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React UI   │────▶│  Express Server  │────▶│  Flat Files     │
│  (Vite)     │◀────│  (REST API)      │◀────│  (data/ dir)    │
└─────────────┘     │                  │     └─────────────────┘
                    │  Task Runner     │
                    │  (interval poll) │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  OpenCode       │
                    │  (child process) │
                    │  w/ agent +     │
                    │  skills + model │
                    └─────────────────┘
```

### 3.4 State Storage (Flat Files)

All persistent state lives in `data/companies/{slug}/` as JSON files:

**company.json**
```json
{
  "id": "acme-corp",
  "name": "Acme Corp",
  "createdAt": "2026-08-26T00:00:00Z",
  "updatedAt": "2026-08-26T00:00:00Z"
}
```

**employees.json**
```json
{
  "employees": [
    {
      "id": "emp-1",
      "name": "Alice (Senior Dev)",
      "role": "Senior Software Engineer",
      "persona": "Experienced TypeScript developer, writes clean code, good at architecture",
      "agent": "OpenCoder",
      "skills": ["task-management"],
      "model": "deepseek/deepseek-v4-pro",
      "status": "available",
      "createdAt": "2026-08-26T00:00:00Z"
    }
  ]
}
```

**projects.json**
```json
{
  "projects": [
    {
      "id": "proj-1",
      "name": "My SaaS App",
      "description": "The main product",
      "path": "/home/jhatfield/Documents/gitrepos/my-saas",
      "contextFiles": [],
      "createdAt": "2026-08-26T00:00:00Z"
    }
  ]
}
```

**tasks.json**
```json
{
  "tasks": [
    {
      "id": "task-1",
      "projectId": "proj-1",
      "title": "Add user authentication",
      "description": "Implement login/register with JWT...",
      "status": "todo",
      "assignedTo": null,
      "sessionId": null,
      "outputFile": null,
      "createdAt": "2026-08-26T00:00:00Z",
      "updatedAt": "2026-08-26T00:00:00Z"
    }
  ]
}
```

**cabinet/manifest.json**
```json
{
  "files": [
    {
      "id": "file-1",
      "name": "company-coding-standards.md",
      "path": "files/company-coding-standards.md",
      "type": "company",
      "linkedTaskIds": [],
      "linkedProjectIds": [],
      "createdAt": "2026-08-26T00:00:00Z"
    }
  ]
}
```

---

## 4. API Design (MVP)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/companies` | List companies |
| `POST` | `/api/companies` | Create company |
| `GET` | `/api/companies/:slug` | Get company details |
| `GET` | `/api/companies/:slug/employees` | List employees |
| `POST` | `/api/companies/:slug/employees` | Add employee |
| `PUT` | `/api/companies/:slug/employees/:id` | Update employee |
| `DELETE` | `/api/companies/:slug/employees/:id` | Remove employee |
| `GET` | `/api/companies/:slug/projects` | List projects |
| `POST` | `/api/companies/:slug/projects` | Add project |
| `PUT` | `/api/companies/:slug/projects/:id` | Update project |
| `DELETE` | `/api/companies/:slug/projects/:id` | Remove project |
| `GET` | `/api/companies/:slug/tasks` | List tasks (filterable by status, project) |
| `POST` | `/api/companies/:slug/tasks` | Create task |
| `PUT` | `/api/companies/:slug/tasks/:id` | Update task (status change, assign) |
| `DELETE` | `/api/companies/:slug/tasks/:id` | Delete task |
| `GET` | `/api/companies/:slug/cabinet` | List cabinet files |
| `POST` | `/api/companies/:slug/cabinet` | Upload/create cabinet file |
| `GET` | `/api/companies/:slug/cabinet/:fileId` | Get cabinet file content |
| `PUT` | `/api/companies/:slug/cabinet/:fileId` | Update cabinet file |
| `DELETE` | `/api/companies/:slug/cabinet/:fileId` | Delete cabinet file |
| `POST` | `/api/companies/:slug/tasks/:id/run` | Manually trigger task execution |
| `GET` | `/api/companies/:slug/tasks/:id/session` | Get task session status |

---

## 5. Task Runner Design

The task runner is the heart of the system. It runs as an interval-based poller inside the Express server.

### 5.1 Execution Flow

```
1. Poll every 30s for tasks with status="todo"
2. For each todo task:
   a. Find an available employee (status="available")
      - Match by role/skills if task specifies requirements
      - Fall back to any available employee
   b. Mark employee as "busy", task as "in_progress"
   c. Build the OpenCode prompt:
      - Employee persona description
      - Company policies from cabinet (type="company")
      - Project context (path, description, context files)
      - Task description and requirements
   d. Spawn OpenCode session:
      opencode --agent {employee.agent} \
               --model {employee.model} \
               --project {project.path} \
               --prompt "{constructed prompt}"
   e. Monitor session:
      - Capture stdout/stderr
      - Watch for session completion
      - Save output to cabinet as task artifact
   f. On completion:
      - Move task to "for_review"
      - Set employee back to "available"
      - Link output file to task in cabinet manifest
   g. On error:
      - Move task to "todo" (for retry) or "blocked"
      - Set employee back to "available"
      - Log error
```

### 5.2 OpenCode Session Management

OpenCode sessions are spawned as child processes. The server:
- Tracks active sessions in memory (PID, task ID, employee ID)
- Handles graceful shutdown (SIGTERM → kill sessions)
- Survives server restarts (tasks in "in_progress" are reset to "todo" on startup)
- Limits concurrent sessions (configurable, default 1)

---

## 6. MVP Scope

### 6.1 What We Build First

| Feature | Priority | Description | Status |
|---------|----------|-------------|--------|
| Company CRUD | P0 | Create/manage companies via API + UI | ✅ Done |
| Employee CRUD | P0 | Add AI personas, map to OpenCode agents | ✅ Done |
| Project CRUD | P0 | Link local directories as projects | ✅ Done |
| Task CRUD + Lifecycle | P0 | Create tasks, move through statuses | ✅ Done |
| Task Runner | P0 | Auto-pickup todo tasks, spawn OpenCode | ✅ Done |
| Filing Cabinet | P1 | Store/view markdown files | ✅ Done |
| Basic Web UI | P0 | Dashboard, company/employee/project/task views | ✅ Done |
| Task Output Viewing | P1 | View session output, review results | ✅ Done |

### 6.2 What We Skip for MVP

- Multi-employee task assignment (round-robin, skill matching)
- Scheduled/recurring tasks
- Task dependencies (blocked-by)
- Real-time session streaming (SSE/WebSocket)
- Authentication / multi-user
- Desktop app (Electron)
- Mobile support
- GitHub integration
- Company export/import

### 6.3 MVP UI Pages

1. **Dashboard** — Overview: active tasks, employee status, recent activity ✅
2. **Company Settings** — Company name, basic config ✅
3. **Employees** — List, add, edit, remove AI personas ✅
4. **Projects** — List, add, edit, remove project links ✅
5. **Tasks** — Kanban-style board (planned | todo | in_progress | for_review | complete) ✅
6. **Task Detail** — View task, description, output, change status ✅
7. **Cabinet** — Browse files, view content, upload new ✅

---

## 7. Implementation Phases

### Phase 1: Project Scaffold & Core Server ✅
- Initialize monorepo with `packages/server` and `packages/ui`
- Set up TypeScript, Express, Vite, Tailwind
- Implement flat-file store (`file-store.ts`, `manifest.ts`)
- Implement company + employee CRUD (API only)
- Test with curl/Postman

### Phase 2: Projects & Tasks ✅
- Implement project CRUD (API)
- Implement task CRUD with lifecycle (API)
- Add task filtering by status/project
- Test full CRUD flows

### Phase 3: Task Runner ✅
- Implement OpenCode session spawning
- Build the task runner poller
- Handle session lifecycle (start, monitor, complete, error)
- Save task output to cabinet
- Test with a real OpenCode agent on a sample project

### Phase 4: Filing Cabinet ✅
- Implement cabinet CRUD (API)
- Link files to tasks and projects
- Support company-wide policy files

### Phase 5: Web UI ✅
- Build Dashboard page
- Build Company/Employee management pages
- Build Project management page
- Build Task board (Kanban)
- Build Task detail page with output viewer
- Build Cabinet browser

### Phase 6: Polish & Integration Test ✅
- End-to-end flow: create company → add employee → add project → create task → auto-run → review output
- Error handling, edge cases
- README and basic docs

---

## 8. Open Questions / Decisions to Make

1. **Data directory location**: `./data/` (project-relative) or `~/.config/foldai/` (user-global)? Leaning toward `~/.config/foldai/` for persistence across clones.

2. **OpenCode invocation**: Does `opencode` have a headless/CLI mode we can use? Need to verify the exact command for non-interactive session execution.

3. **Session output format**: How do we capture structured output from OpenCode? Plain text? Markdown? Need to understand OpenCode's output format.

4. **Concurrency**: Should we support multiple simultaneous task executions? MVP: single worker, but design for multi-worker.

5. **Employee skill matching**: How do we match tasks to employees? MVP: manual assignment or first-available. Future: tag-based matching.

---

## 9. Development Notes

- **Node version**: Use `nvm use 24` before running any node commands
- **Testing**: Manual testing with curl during MVP; add Vitest later
- **Git**: Commit each phase as a logical unit
- **Config**: All config via flat files, no environment variables except `PORT` and `DATA_DIR`