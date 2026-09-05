# Plan: shadcn/ui Migration (Paperclip-style)

> Migrate Fold AI UI from custom Tailwind components to shadcn/ui (New York style) matching Paperclip's aesthetic.

---

## 1. Dependencies to Add

```bash
npm install class-variance-authority clsx tailwind-merge lucide-react
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-slot @radix-ui/react-label
```

| Package | Purpose |
|---------|---------|
| `class-variance-authority` | Component variant API (Button variants, Badge variants) |
| `clsx` + `tailwind-merge` | `cn()` utility — merges Tailwind classes safely |
| `lucide-react` | Icon library (Paperclip uses this) |
| `@radix-ui/react-dialog` | Accessible modal/dialog primitive |
| `@radix-ui/react-select` | Accessible select dropdown primitive |
| `@radix-ui/react-slot` | `asChild` pattern for polymorphic components |
| `@radix-ui/react-label` | Accessible form labels |

---

## 2. New Files to Create

### 2.1 `src/lib/utils.ts` — `cn()` helper
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

### 2.2 `components.json` — shadcn/ui config
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

### 2.3 `src/index.css` — Paperclip-style theme tokens
Replace the single `@import "tailwindcss"` with:
- `@import "tailwindcss"` + `@theme inline` block
- OKLCH color tokens matching Paperclip's neutral palette
- InterVariable font (bundled or Google Fonts)
- CSS custom properties for `--radius`, `--background`, `--foreground`, etc.
- shadcn/ui semantic color tokens (primary, secondary, destructive, muted, accent, border, ring)

### 2.4 shadcn/ui Components (`src/components/ui/`)
Create these primitives following shadcn New York patterns:

| Component | Replaces | Notes |
|-----------|----------|-------|
| `button.tsx` | All `<button>` elements | CVA variants: default, destructive, outline, secondary, ghost, link. Sizes: default, sm, lg, icon |
| `card.tsx` | Custom card divs | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| `badge.tsx` | `StatusBadge` | CVA variants: default, secondary, destructive, outline. Used for task statuses |
| `input.tsx` | All `<input>` elements | Styled input with focus ring |
| `dialog.tsx` | `Modal` | Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription |
| `select.tsx` | Native `<select>` | Select, SelectTrigger, SelectValue, SelectContent, SelectItem |
| `label.tsx` | All `<label>` elements | Radix Label primitive |

### 2.5 `vite.config.ts` — add path alias
```ts
resolve: { alias: { "@": "/src" } }
```

### 2.6 `tsconfig.json` — add path alias
```json
"paths": { "@/*": ["./src/*"] }
```

---

## 3. Components to Rewrite

### 3.1 `Modal` → `Dialog`
- Replace `<dialog>` element with shadcn `<Dialog>` + `<DialogContent>`
- Use `<DialogHeader>` + `<DialogTitle>` for the title bar
- Keep the same props interface (`open`, `onClose`, `title`, `children`)

### 3.2 `StatusBadge` → `Badge`
- Replace custom span with shadcn `<Badge variant="...">`
- Map task statuses to badge variants:
  - `planned` → `secondary`
  - `todo` → `default` (blue)
  - `in_progress` → `default` (amber)
  - `for_review` → `default` (violet)
  - `complete` → `default` (green)
  - `blocked` → `destructive`
  - `cancelled` → `outline`

### 3.3 `Layout` — restyle nav
- Use shadcn `<Button variant="ghost">` for nav links
- Use `lucide-react` icons for nav items (LayoutDashboard, Building2, Users, FolderKanban, ListTodo, Archive)
- Keep the same structure, just swap styling

### 3.4 `ModelSelect` — use shadcn primitives
- Use `<Input>` for the search field
- Use `<Command>` (cmdk) or keep custom dropdown with shadcn styling

---

## 4. Pages to Update

All 7 pages need button/input/card swaps:

| Page | Changes |
|------|---------|
| **Dashboard** | Cards → `<Card>`, stat cards → `<Card>` with colored borders |
| **Companies** | "New Company" button → `<Button>`, list items → `<Card>`, form inputs → `<Input>` |
| **Employees** | "Add Employee" button → `<Button>`, employee cards → `<Card>`, form → `<Input>` + `<Label>`, model select → `<Select>` or keep `ModelSelect` |
| **Projects** | Same pattern as Employees |
| **Tasks** | Kanban columns → `<Card>`, "New Task" button → `<Button>`, task cards → `<Card>`, form → `<Input>` + `<Select>` + `<Label>` |
| **TaskDetail** | Action buttons → `<Button variant="...">`, output viewer → `<Card>` |
| **Cabinet** | File list items → `<Card>`, "New File" button → `<Button>`, form → `<Input>` + `<Textarea>` + `<Label>`, type badges → `<Badge>` |

---

## 5. Implementation Order

### Wave 1: Foundation (deps + config + primitives)
1. Install all new dependencies
2. Create `src/lib/utils.ts`
3. Create `components.json`
4. Update `index.css` with Paperclip theme tokens
5. Update `vite.config.ts` + `tsconfig.json` with `@` alias
6. Create all 7 shadcn UI primitives in `src/components/ui/`

### Wave 2: Component rewrites
7. Rewrite `Modal` → `Dialog`
8. Rewrite `StatusBadge` → `Badge`
9. Rewrite `Layout` with icons + Button variants

### Wave 3: Page updates
10. Update Dashboard
11. Update Companies
12. Update Employees
13. Update Projects
14. Update Tasks
15. Update TaskDetail
16. Update Cabinet

### Wave 4: Verify
17. TypeScript check
18. Vite build
19. Visual smoke test (start server + UI)

---

## 6. What Stays the Same

- **Stores** (5 Zustand stores) — no changes
- **API client** (`api/client.ts`) — no changes
- **Routing** (`App.tsx`) — no changes
- **Server** — no changes
- **`ModelSelect`** — keep as-is, just restyle with shadcn Input

---

## 7. Design Tokens (Paperclip-inspired)

```css
@theme inline {
  --color-background: oklch(0.145 0 0);
  --color-foreground: oklch(0.985 0 0);
  --color-card: oklch(0.17 0 0);
  --color-card-foreground: oklch(0.985 0 0);
  --color-primary: oklch(0.985 0 0);
  --color-primary-foreground: oklch(0.145 0 0);
  --color-secondary: oklch(0.27 0 0);
  --color-secondary-foreground: oklch(0.985 0 0);
  --color-muted: oklch(0.27 0 0);
  --color-muted-foreground: oklch(0.71 0 0);
  --color-accent: oklch(0.27 0 0);
  --color-accent-foreground: oklch(0.985 0 0);
  --color-destructive: oklch(0.58 0.24 27);
  --color-border: oklch(0.27 0 0);
  --color-ring: oklch(0.55 0 0);
  --radius: 0.5rem;
}
```

Font: Inter (variable), monospace for code/IDs.