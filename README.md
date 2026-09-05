# Fold AI

A web UI + automation layer over OpenCode that runs a virtual company of AI agents on your local machine.

## Concept

Fold AI lets you create a "company" with AI employees (personas mapped to OpenCode agents), assign them to projects (local directories), and run tasks through an automated task runner. Think of it as a project management tool where your staff are AI agents.

- **Companies** — Workspaces containing employees, projects, tasks, and a filing cabinet
- **Employees** — AI personas backed by your existing OpenCode agents and skills
- **Projects** — Links to local directories on your machine
- **Tasks** — Units of work with a lifecycle: planned → todo → in_progress → for_review → complete
- **Task Runner** — Auto-picks up todo tasks, spawns OpenCode sessions, captures output
- **Filing Cabinet** — Markdown file store for policies, plans, and task outputs

## Quick Start

```bash
# Requires Node.js 24+
nvm use 24

# Install dependencies
npm install

# Start the server (API on :3001)
npm run dev:server

# Start the UI (on :5173, proxies /api to :3001)
npm run dev:ui
```

Open http://localhost:5173 in your browser.

## Architecture

```
packages/
├── server/          # Express 5 API + task runner
│   └── src/
│       ├── routes/       # REST endpoints
│       ├── services/     # Business logic
│       ├── store/        # Flat-file persistence
│       └── opencode/     # OpenCode process management
└── ui/              # React 19 + Vite + Tailwind 4
    └── src/
        ├── api/          # Typed API client
        ├── stores/       # Zustand state management
        ├── pages/        # 7 page components
        └── components/   # Shared UI components
```

All state is stored as flat JSON files in `~/.config/foldai/companies/{slug}/`.

## Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `PORT` | `3001` | Server port |
| `FOLDAI_DATA_DIR` | `~/.config/foldai` | Data directory |
| `FOLDAI_RUNNER_ENABLED` | `true` | Enable/disable task runner |
| `FOLDAI_RUNNER_INTERVAL` | `30000` | Poll interval in ms |
| `FOLDAI_RUNNER_TIMEOUT` | `600000` | Session timeout in ms |
| `FOLDAI_RUNNER_MAX_RETRIES` | `3` | Max retries before blocking |

## API Endpoints

### Companies
- `GET /api/companies` — List
- `POST /api/companies` — Create `{ name }`
- `GET /api/companies/:slug` — Get

### Employees
- `GET /api/companies/:slug/employees` — List
- `POST /api/companies/:slug/employees` — Create
- `GET /api/companies/:slug/employees/:id` — Get
- `PUT /api/companies/:slug/employees/:id` — Update
- `DELETE /api/companies/:slug/employees/:id` — Delete

### Projects
- `GET /api/companies/:slug/projects` — List
- `POST /api/companies/:slug/projects` — Create
- `GET /api/companies/:slug/projects/:id` — Get
- `PUT /api/companies/:slug/projects/:id` — Update
- `DELETE /api/companies/:slug/projects/:id` — Delete

### Tasks
- `GET /api/companies/:slug/tasks?status=todo&projectId=xxx` — List with filters
- `POST /api/companies/:slug/tasks` — Create
- `GET /api/companies/:slug/tasks/:id` — Get
- `PUT /api/companies/:slug/tasks/:id` — Update
- `DELETE /api/companies/:slug/tasks/:id` — Delete
- `POST /api/companies/:slug/tasks/:id/run` — Trigger execution
- `GET /api/companies/:slug/tasks/:id/output` — Get task output

### Cabinet
- `GET /api/companies/:slug/cabinet` — List files
- `POST /api/companies/:slug/cabinet` — Create file
- `GET /api/companies/:slug/cabinet/:id` — Get metadata
- `GET /api/companies/:slug/cabinet/:id/content` — Get content
- `PUT /api/companies/:slug/cabinet/:id` — Update metadata
- `PUT /api/companies/:slug/cabinet/:id/content` — Update content
- `DELETE /api/companies/:slug/cabinet/:id` — Delete

## Task Lifecycle

```
planned → todo → in_progress → for_review → complete
                ↑        ↓
                └── retry ──→ blocked (after max retries)
```

## License

MIT