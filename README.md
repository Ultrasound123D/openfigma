<p align="center">
  <img src="img/sign.jpeg" alt="OpenFigma" width="100%" />
</p>

# 🎨 OpenFigma — A Figma-Style Design Editor for the Browser

**OpenFigma** is a practical, production-shaped clone of a **Figma-like** vector design editor, built entirely with **Next.js 16 + React 19 + TypeScript**, an **SVG rendering engine**, and **Zustand** state management. Fully useable out of the box: no heavy database, no deploy complexity — run it and start designing.

---

## 📖 How it started

The idea began in December 2025 as an experiment to understand **how real design editors work from the inside**:

1. **Deconstructing the original** — the way Figma behaves on the canvas was studied feature by feature: selection, snapping, guides, layout, history.
2. **Clean rebuild with open tools** — instead of copying, every feature was rebuilt from scratch: Next.js + React instead of the original web stack, SVG instead of the C++/WebGL engine.
3. **Documented architectural decisions** — every important trade-off (SVG vs WebGL, Zustand vs Redux, dual persistence...) was written down with alternatives and reasoning as it was made.
4. **Methodical verification** — features are checked one by one against the original behavior: more than 50 core features (smart guides, boolean ops, auto-layout, components, undo/redo...) reached ✅ **100% verified**.

---

## 🧠 How it works (Architecture)

```
┌────────────────────────────────────────────────────┐
│                     Browser                        │
│                                                    │
│  EditorLayout (shell)                              │
│  ├── Toolbar          tool strip                   │
│  ├── Canvas.tsx       SVG canvas (zoom/pan/tools)  │
│  ├── LayerPanel       layer tree                   │
│  └── PropertiesPanel  property inspector           │
│            │                                       │
│            ▼                                       │
│  Zustand Store (editor-store.ts)                   │
│  elements · pages · selection · history · clipboard│
│            │                                       │
│            ▼                                       │
│  Pure logic                                        │
│  element-utils · auto-layout · boolean-ops          │
│  snap-utils · export · image-utils                 │
│            │                                       │
│            ▼                                       │
│  Persistence                                       │
│  IndexedDB (auto-save 30s) + JSON on server        │
└────────────────────────────────────────────────────┘
        ▲
        │  HTTP (25+ API routes)
        │
   MCP Server ──── AI agent (Claude / opencode / Cursor)
```

### Core data model
Everything on the canvas is a `DesignElement` — a tree linked by `parentId`:
- **Types:** `rectangle, ellipse, text, line, polygon, star, arrow, frame, image, pen/mask, boolean`
- **Properties:** position/size/rotation, fill layers (solid/gradient/image), strokes, shadows & blur, opacity, blend mode
- Frames/groups hold children; with **Auto Layout** the layout recalculates automatically when children change

### User interaction flow
1. A user event is captured by `Canvas.tsx` (click / drag / type)
2. While drawing: a live `<rect>` preview; on release it goes through `addElement`
3. A store action runs (70+ actions) and calls `pushHistory` (undo point)
4. Selective re-render via selectors — no full tree re-paint

### Ready-to-use feature set
- **Editing** — single/multi select + rubber band, 8 resize handles, 15° rotation (Shift), Alt+Drag duplicate
- **Smart guides** — red dashed alignment lines, 6px grid snap, Alt+Hover distance measurement
- **Inline text** — double-click to edit text directly on the canvas
- **Boolean ops** — Union / Subtract / Intersect / Exclude on vector paths
- **Auto Layout** — direction, gap, padding, alignment, sizing modes
- **Components & variants** — create/instance/detach, document colors and fonts panels
- **Export** — PNG / SVG / PDF via `ExportPanel` or the API
- **Multi-page system**, prototype interaction builder, CSS code generation in the Inspect tab
- **Undo/Redo** — snapshot history pushed from 25+ call sites

### Dual persistence layer
| Path | File | Usage |
|---|---|---|
| Browser | `storage.ts` → IndexedDB | auto-save every 30s, loaded on start |
| Server | `server-state.ts` → `.design-data/<id>.json` | single source of truth for API + MCP |

The same data flows through 8 Next.js App Router API routes (`/api/designs`, `/api/export`, `/api/editor/projects/...`) — this is what makes the editor scriptable and AI-controllable.

---

## 🚀 Run locally

```bash
npm install      # dependencies
npm run dev      # dev server on http://localhost:3000
```

- No database setup needed — a demo design ("VidVerse") loads automatically on the first visit
- Requires Node 18+

---

## 🤖 Connecting the editor to MCP (Model Context Protocol)

### What MCP means here
The ready-to-run MCP server lives in `mcp-server/` and communicates over the **stdio JSON-RPC transport**.
The AI agent consumes it and talks to the editor: it sends `fetch` calls to the server API, which creates / edits / reads your designs.

```
AI agent (Claude Desktop / opencode / Cursor)
        │  tool call  e.g. create_rectangle({x:100,...})
        ▼
MCP Server (mcp-server/dist/index.js via stdio)
        │  fetch http://localhost:3000/api/...
        ▼
API Routes (Next.js)  ──►  server-state.ts  ──►  .design-data/<id>.json
        │
        ▼
Design updated & saved — the app shows it live
```

> ⚠️ The editor server must be running (`npm run dev`) on port 3000 — MCP talks to it over HTTP.

### Step 1 — Build the MCP server
```bash
cd mcp-server
npm install
npm run build     # produces mcp-server/dist/index.js
```
> The repo ships with `dist` already built — you may skip this step.

### Step 2 — Configure the connection
`mcp-config.json` at the project root:
```json
{
  "mcpServers": {
    "figma-editor": {
      "command": "node",
      "args": ["C:\\Users\\HP\\Desktop\\figma_project (1)\\mcp-server\\dist\\index.js"],
      "env": { "EDITOR_API_URL": "http://localhost:3000" }
    }
  }
}
```
Adjust `args` to match your own `dist/index.js` path, and `EDITOR_API_URL` if the server runs on another port.

### Step 3 — Register with your client

| Client | File | Location |
|---|---|---|
| **Claude Desktop** | `claude_desktop_config.json` | `%APPDATA%\Claude\` — add the `mcpServers` block above |
| **opencode** | `opencode.json` | project root: `"mcp": { "figma-editor": { "type": "local", "command": ["node", "...\\dist\\index.js"], "environment": { "EDITOR_API_URL": "http://localhost:3000" } } }` |
| **Cursor** | `mcp.json` | `.cursor/mcp.json` in the project or `~/.cursor/` |
| **VS Code (Copilot)** | `mcp.json` | `.vscode/mcp.json` using the same structure |

Save the config file, then **restart the client** so it discovers the tools.

### Step 4 — Give the AI its first task
Type something like:
```
Create a project "Login UI" with a gray frame,
and inside it a white card with a green "Sign in" button
```
The agent will chain the tools automatically:
`list_projects → create_project → create_frame → create_text → update_element ...`

### All available MCP tools (52)

> Count verified from source: 16 direct registrations + 36 generated via `makeCreateTool` / `toolAction` helpers = **52 tools**.

| Category | Tools |
|---|---|
| 📂 Projects (4) | `create_project` · `list_projects` · `get_project` · `delete_project` |
| ✏️ Create elements (8) | `create_rectangle` · `create_ellipse` · `create_frame` · `create_line` · `create_polygon` · `create_star` · `create_arrow` · `create_text` |
| 🔧 Element CRUD (4) | `get_element` · `update_element` · `delete_element` · `list_elements` |
| 🔄 Transform & arrange (11) | `move_element` · `move_element_to` · `resize_element` · `rotate_element` · `duplicate_element` · `group_elements` · `ungroup_elements` · `bring_forward` · `send_backward` · `bring_to_front` · `send_to_back` |
| 📐 Align & distribute (2) | `align_elements` · `distribute_elements` |
| 🎨 Style (8) | `set_fill` · `set_stroke` · `set_corner_radius` · `set_opacity` · `set_blend_mode` · `add_shadow` · `flip_horizontal` · `flip_vertical` |
| ✍️ Text (2) | `set_text_content` · `set_text_style` |
| 🔒 Visibility & metadata (3) | `set_visible` · `set_locked` · `rename_element` |
| 🔍 Query (2) | `search_elements` · `get_all_elements` |
| 🧹 Canvas (1) | `clear_canvas` |
| 📄 Pages (4) | `list_pages` · `create_page` · `set_active_page` · `delete_page` |
| 🧩 Ready-made UI (3) | `draw_ui_card` · `draw_button` · `draw_phone_frame` |

### MCP troubleshooting

| Problem | Fix |
|---|---|
| Tools don't show in the client | Try `node mcp-server\dist\index.js` manually — if it stays alive the server is fine; fix the client config and restart it |
| `fetch failed` in tool results | The editor server isn't running — start `npm run dev` first |
| `EADDRINUSE :3000` | An old server is running: stop it or use another port (`next dev -p 3001`) |
| `project not found` | Run `list_projects` and copy the correct id |
| `dist` path changed | Update the path in `mcp-config.json` / client config |

---

## 🗂️ Project structure

```
├── src/app/           editor page + 8 API routes
├── src/components/
│   ├── editor/        18 editor components (Canvas, Toolbar, Panels...)
│   └── ui/            48 shadcn/ui components
├── src/lib/           engine logic (element-utils, auto-layout, boolean-ops,
│                      snap-utils, storage, server-state, export)
├── src/store/         editor-store.ts (Zustand, ~2150 lines)
├── src/data/          demo-design.ts (initial demo design)
├── mcp-server/        MCP server (52 tools) + config
├── prisma/            schema (optional)
└── img/               sign.jpeg (cover image)
```

---

<p align="center">
  <sub>Built with Next.js 16 · React 19 · SVG · Zustand · shadcn/ui · MCP</sub>
</p>
