# Architecture — Drawboard PDF + Notes desktop clone

Codename: **Inkdesk** (working title — final naming via /replica-brand).
Reads: `replica/recon.md`, `replica/features.csv`, `replica/PLAN.md` (30-phase roadmap).
Target: Windows 10/11 desktop, local-first, offline, **100% free — no subscriptions, no locks, no accounts, no ads**.

## Requirements (from Anshu — compiled)

- **R1 Everything free:** every Drawboard feature ships unlocked — Pro-tier tools (measurement, doc builder, unlimited signatures, templates, compression, text-review export) are standard features. No paywalls, trials, account walls, ads.
- **R2 Same look, same vibe:** replicate Drawboard's layout language — radial menu, dockable favorites bar, circular colored tool icons grouped by category, dark chrome, touch/stylus-first feel — with 100% original assets (clean-room; never their logo/icons/copy).
- **R3 Language:** TypeScript everywhere Anshu works (app logic, UI, ink engine, PDF pipeline). Rust only as the thin Tauri shell (window, FS, print, protocol) — small surface he rarely touches.
- **R4 Optimization is first-class:** hard performance budget (below) because the dev machine is low-end. Perf gates are exit criteria, not an afterthought.
- **R5 REA escalation:** when a feature stalls, use the REA MCP (reverse-engineering tools) to unblock — behavioral analysis only: how the feature *behaves*, its states, parameters, file/output format. Never copy their code, assets, or ship decompiled artifacts. Clean-room line: RE to understand, rebuild from scratch.
- **R6 Platform:** Windows desktop only. No cloud/backend anything.

## Step 1 — The stack

| layer | choice | why (one line) |
|---|---|---|
| shell | **Tauri 2 + WebView2** | tiny binary + low RAM for a low-end PC; toolchain already installed and proven on this machine |
| frontend | **React 18 + TypeScript + Vite** | boring, fast, Anshu knows it |
| rendering | **pdf.js (Firefox PDF viewer lib)** | mature: text layer, search, thumbnails, workers; renders to canvas |
| ink engine | **perfect-freehand** (MIT) + Pointer Events | pressure-tapered strokes that feel like ink, 1000s of points cheap |
| local DB | **SQLite via tauri-plugin-sql** | one file at %APPDATA%; boring, zero-config |
| PDF write path | **pdf-lib (JS)** | create blank PDFs, merge, reorder pages, stamp flattened overlays, compress basics — all client-side |
| printing | flatten → temp PDF → Windows shell `print` verb | no fragile WebView print pipeline |
| state | Zustand | small; per-doc stores |
| styling | plain CSS + design tokens (from /replica-design) | no Tailwind build weight needed; tokens keep rebrand easy |

No accounts, no server, no payments — the recon skipped everything cloud (their owned network).

### The one hard architectural decision: how annotations are stored

- **v1: sidecar model.** Annotations live in SQLite keyed by `(document_path, page_index)`; the PDF file itself is never touched until export. Editing is instant, non-destructive, undo is trivial.
- **Flatten/export** renders the annotation overlay per page to a canvas at 150–200 DPI and stamps it onto the page with pdf-lib → produces a real PDF any reader shows.
- **v2 (optional): native PDF annotations** via pdfium's annotation API (FPDFAnnt_*) so markups are editable in Adobe/Edge. Expensive; only if wanted.

## Step 2 — Schema (SQLite; full DDL in `replica/schema.sql`)

7 tables: `documents`, `annotations`, `tool_presets`, `toolbars` + `toolbar_items`, `signatures`, `bookmarks`, `app_settings` (+`markup_history` view of annotations' timestamps). Owner column N/A (single local user); FK `annotations.document_id → documents.id ON DELETE CASCADE`; indexes on every filter path — see DDL. Access rules: none needed (single-user desktop), enforced instead by "all IPC commands validate paths live under user-approved opens".

Hard constraint from recon: **annotation model must round-trip** — save → close → reopen shows identical markup, and flatten output must be viewable in other PDF readers (test in Edge).

## Step 3 — The "API": Tauri IPC commands (routes by flow)

| command | what it does | input → output | flow |
|---|---|---|---|
| `dialog_open_pdf` | file picker for PDFs | → path | F01 |
| `doc_open` | stat + register doc, return meta + last state | path → Document | F01 |
| `doc_recent_list` / `doc_forget` | recents management | → Document[] | F01 |
| `ann_list` / `ann_put` / `ann_patch` / `ann_delete` | annotation CRUD (batched per stroke commit) | doc+page → Annotation[] | F02–F06 |
| `doc_save_state` | zoom/night/last-page per doc | Document | F01 |
| `pdf_create_blank` | new PDF from size/color/orientation/pages/template | spec → path | F08 |
| `pdf_save_as` | copy current + sidecar state to new path | doc, path | F10 |
| `pdf_flatten` | overlay-render + stamp pages (all/selected), quality level | doc, opts → path | F10 |
| `pdf_compress` | re-encode images at low/high | doc, level → path | F10 |
| `pdf_print` | flatten to temp + shell print verb | doc | F10 |
| `pdf_export_text_review` | quoted text-review annots → .txt/.csv | doc, fmt → path | F03 |
| `pdf_export_pages` | export page subset (annotated) | doc, pages → path | F10 |
| `pages_insert` / `pages_rotate` / `pages_delete` / `pages_reorder` | page manipulation (writes new PDF via pdf-lib) | doc, ops | F07 |
| `pdf_merge` | document builder merge | doc+doc+order → path | F12 |
| `bookmark_*` | CRUD | doc → Bookmark[] | F09 |
| `toolbar_*` / `preset_*` / `signature_*` / `settings_*` | UI persistence CRUD | — | S05/S07/S17 |
| `shell_print` / `shell_share` | OS integration | path | F10 |

Background jobs: none (desktop app). Webhooks: none.

## Step 4 — The parts that bite

- **Ink latency** — wet-layer canvas: current stroke renders synchronously on pointermove (with `getCoalescedEvents` for 240 Hz pens), committed to model + SQLite only on pointerup; rAF-batched.
- **Mouse has no pressure** — constant-width fallback; perfect-freehand `simulatePressure` for mouse.
- **Palm rejection** — PointerType filter: `pen` draws, `touch` pans (toggleable), `mouse` draws.
- **Large PDFs** — pdf.js in a worker, render only visible ±1 page, thumbnail grid renders lazily at low scale.
- **Night mode** — CSS `filter: invert(0.92) hue-rotate(180deg)` on page canvas + un-invert annotation layer colors; per-doc toggle.
- **Flatten fidelity/size** — 150 DPI default, 200 optional; JPEG q0.8 for scans, PNG for vector pages; never overwrite original without confirm dialog (destructive).
- **Scanned PDFs** — no text layer → text review falls back to freehand highlighter; search disabled with hint (recon edge case).
- **WebView2 file access** — stream PDFs via Tauri custom protocol (`inkdesk://pdf/<id>`) instead of file:// URLs.
- **Undo/redo** — per-document in-memory stacks (session-scoped); markup history panel persists from `annotations.created_at/updated_at`.
- **Windows paths** — everything via `PathBuf` in Rust commands; frontend never touches raw paths for reads (protocol handles bytes).

## Step 5 — Build order

| milestone | ships | screens | tables touched |
|---|---|---|---|
| **M0 — proof** | Tauri+React+pdf.js opens a PDF, continuous scroll, zoom/pan, tab bar, custom protocol streaming | S03, S02 | — |
| **M1 — vertical slice (core loop)** | pen ink with pressure → persisted → reopens identical → Save as new + Flatten produce real PDFs viewable in Edge | S03, S07 (minimal), S11 (minimal) | documents, annotations |
| **M2 — must-haves** | highlighter, eraser, text review ×4, shapes ×7, textbox/note/image/signature, undo/redo, selection ops, pages grid ops, bookmarks, search, night mode, page indicator, radial menu, favorites bar, stylus/touch toggle, print/share, new blank doc w/ templates, recents | S04–S09, S12, S13, S16, S17, S18 | all 8 |
| **M3 — should-haves** | line styles, color picker, multi-toolbars + presets + import/export, nav history, layout modes, detailed markup history, document builder (merge) | S05 full, S14, S15 | toolbars full |
| **M4 — could-haves** | measurement + calibration, protractor, compression, text-review export, hyperlinks, stamps/markup library, audio notes, redaction, laser pointer, tags, snapshot, align/distribute, shortcuts, z-order, Surface Dial (generic) | S10 | +measurements |
| **M5 — test & ship** | /replica-test click-through + e2e, /replica-diff parity score, /replica-brand rebrand + sweep, /replica-deploy: NSIS installer | — | — |

**Next phases after build:** /replica-design → /replica-build (M0) → /replica-test → /replica-diff → /replica-entrepreneur (mine Drawboard's reviews for fixes) → /replica-brand → /replica-launch → /replica-deploy.

## Performance budget (R4 — enforced per phase)

| metric | budget | measured in |
|---|---|---|
| cold start → doc open | < 2.5 s on dev machine | P25 |
| first page painted | < 600 ms | P4 |
| ink stroke latency | < 1 frame (≤ 16 ms), zero visible lag | P7 |
| 500-page doc open + scroll | no dropped frames > 3 in a row | P25 |
| idle RAM (1 doc, 50 pages) | < 350 MB | P25 |
| installer size | < 25 MB | P30 |

## REA escalation policy (R5)

Trigger: a feature is stuck after one honest implementation attempt (flatten output wrong, annotation format mystery, ink behavior unclear).
Procedure: `skill_view('reverse-engineer-anything')` → REA on the **installed Drawboard app or its saved documents** → answer only the blocked question (behavior, states, parameters, output format) → rebuild clean in TS. Boundary: no copying code/assets/strings into the repo; RE artifacts stay in `replica/rea-notes/` (never shipped).

Full phase-by-phase roadmap: **`replica/PLAN.md`** (30 phases, P1–P30).

Risks: ink feel (mitigate M1, iterate), flatten fidelity (test matrix early in M1), pdf.js + WebView2 quirks (M0 proves it).
