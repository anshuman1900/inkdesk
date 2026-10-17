# PLAN — Inkdesk (Drawboard PDF + Notes desktop clone)

Working title **Inkdesk** · project root `E:\drawboard-clone` · app source in `app/`, replica docs in `replica/`.
Read with: `recon.md` (what the app is), `features.csv` (what we build), `architecture.md` (how).

**Standing requirements:** everything free/unlocked (R1) · Drawboard's look & vibe, original assets (R2) · TypeScript-first, Rust shell only (R3) · perf budget enforced (R4) · REA MCP escalation when stuck, behavioral-only (R5) · Windows desktop, local-only (R6).

**Every phase ends with a commit + a verifiable exit check.** A phase is done when its exit check passes on the dev machine, not when the code looks finished.

---

## Stage A — Foundation (P1–P3)

### P1 — Project scaffold
Tauri 2 + React 18 + TypeScript + Vite skeleton at `E:\drawboard-clone\app`; git init; folder layout per architecture.md; tauri-plugin-sql wired with `schema.sql`; custom protocol stub (`inkdesk://pdf/<id>`); app window opens (dark chrome, no titlebar custom yet).
**Exit:** `npm run tauri dev` opens the window; SQLite DB created at %APPDATA% with all 8 tables; `git log` has commit 1.

### P2 — Design tokens & UI kit (replica-design)
Extract Drawboard's visual language from `replica/screens/` + help docs into `tokens.json`: dark chrome palette, canvas bg, circular tool-icon style, accent colors per tool category (draw/insert/measure/select/pro), radii, spacing, fonts (open-licensed equivalents). Build the base UI kit: circular tool button, category chip, panel, dialog, slider, color swatches.
**Exit:** a single static page in-app rendering every kit component from tokens; WCAG contrast check (contrast.py) passes on the token palette.

### P3 — Reference capture (drive the real app)
Install free Drawboard PDF from the MS Store on this machine; walk every screen/state at human speed; screenshot into `replica/screens/` (radial menu open/closed, favorites bar docked/floating, pages grid, properties popover, night mode, empty states). Behavioral notes into `replica/recon-notes.md`.
**Exit:** ≥ 15 reference screenshots covering S03–S18; every screen in recon.md has at least one reference image.

---

## Stage B — Reader (P4–P6) · milestone M0

### P4 — PDF rendering proof
pdf.js integrated (worker, custom protocol streaming); open PDF → continuous scroll page list; zoom (ctrl+wheel, pinch), pan (hand/space-drag); fit-width/fit-page; render only visible ±1 page (virtualization); thumbnails lazy.
**Exit:** open a 100+ page PDF; scroll is smooth (no >3 consecutive dropped frames); first page painted < 600 ms (log it); screenshot as evidence.

### P5 — Tabs, recents & home
Tab bar (open/close/switch, overflow, dirty indicator); home/library screen (recents grid, open, new blank doc, forget); `doc_open/recent_list/forget` IPC.
**Exit:** 3 docs open in tabs, switch < 100 ms; recents persist across app restart.

### P6 — View system
Night mode (page canvas filter + annotation color re-map, per-doc toggle, persisted); page indicator chip + page jump; navigation history (back/forward); layout modes (continuous/single); settings screen (S17) hosting radial toggle, stylus/touch mode, layout, language placeholder.
**Exit:** night mode toggle instant (< 50 ms) and survives restart; nav history returns to previous page after jump.

---

## Stage C — Ink & persistence (P7–P8) · milestone M1 (core loop)

### P7 — Ink engine
Pointer Events pipeline: pen/touch/mouse discrimination, palm rejection, `getCoalescedEvents` for high-Hz pens; wet-layer canvas (current stroke zero-lag) → commit to model on pointerup; perfect-freehand pressure-tapered rendering; eraser preview infrastructure; pressure-less fallback (mouse: simulatePressure).
**Exit:** ink latency ≤ 1 frame on the dev machine (rAF timestamp vs pointer event timestamp log); stroke looks tapered under pressure; 500-point stroke renders without jank.

### P8 — Annotation store & undo
annotations CRUD IPC batched per stroke; per-document undo/redo stacks; round-trip persistence (close → reopen identical); delete/move of committed strokes; z_order defaulting.
**Exit:** draw 20 strokes → restart → identical; undo/redo 25 levels; DB row count matches stroke count; screenshot before/after restart.

---

## Stage D — Drawboard's signature UI (P9–P10)

### P9 — Radial menu
8 slots (Pan, Select, Pen, Pen 2, Highlighter, Eraser, Text review, More) with variant sub-flyouts (per help-doc behavior); drag to reposition; toggle in settings; opens near pointer; keyboard/pen long-press variants.
**Exit:** matches P3 reference screenshots; every slot activates its tool; toggle persists.

### P10 — Favorites bar & tool properties
Dockable favorites bar (left/right/top/floating, drag handle); add/remove/reorder tools (drag + picker panel S06 with category pages); multiple named toolbars, presets (construction/architecture-style), import/export; tool properties popover (color swatches + custom picker, width/opacity sliders, pressure toggle) persisted per preset; free-tier cap NOT applied (R1 — unlimited).
**Exit:** toolbar re-docks live by drag; custom toolbar survives restart; properties edit a committed stroke's style.

---

## Stage E — Full markup toolkit (P11–P15) · must-haves

### P11 — Pen, highlighter, eraser
Pen (colors, widths, opacity, pressure), second pen slot, freehand highlighter (multiply-style blend), per-stroke eraser with size; quick-erase gesture; stroke style edit after commit.
**Exit:** parity with P3 references for each tool; erasing a highlighter stroke doesn't affect ink beneath.

### P12 — Text review
Text-layer selection → text highlight / underline / strikeout / squiggly / remove-review, styled per tokens; freehand highlighter fallback for scanned pages (no text layer) with hint; stores quoted text for later export.
**Exit:** all 4 styles on a text PDF; quoted text correct for random-string test PDF; scanned PDF falls back gracefully.

### P13 — Shapes & lines
line, arrow, rectangle, ellipse, polygon, polyline, cloud (scallop edge); drag-to-draw with live preview; dash/dot engineering line styles; color picker integration; post-draw vertex nudge.
**Exit:** all 7 shapes render + persist + flatten (smoke via P20 harness when ready); line styles visible at 4 widths.

### P14 — Insert suite
Textbox (inline edit, font size), sticky note (icon ⇄ expanded), callout (pointer + box), image from file (scale/rotate), signature (draw pad + type; bank with unlimited entries, R1), audio note (record, pin, playback); stamps groundwork.
**Exit:** each insert type placed on a page, edited, persisted, restarts identically; signature bank ≥ 3 saved signatures.

### P15 — Selection system
Rect / lasso / text select modes; multi-select; move, delete, copy/paste duplicate, z-order (bring forward/back); align/distribute; laser pointer (fading trail, presentation mode).
**Exit:** lasso 10 mixed annotations → move as group → z-order change visible over overlapping shapes; laser fades ≤ 2 s.

---

## Stage F — Document management (P16–P19)

### P16 — Pages
Pages grid view (thumbnails, lazy render); drag-drop reorder; insert blank/image page; rotate; duplicate; delete; all via pdf-lib rewrite with sidecar remap (annotations follow their page indexes through reorder/delete).
**Exit:** reorder → annotations stay glued to their pages; 200-page doc grid stays responsive (virtualized).

### P17 — New blank documents & templates
New-doc dialog: page size presets, custom size, page color, orientation, page count; grid/lines/dots templates + overlays rendered under ink and included in flatten.
**Exit:** create 50-page dotted A4 doc; template visible in flatten output; annotations persist on template pages.

### P18 — Bookmarks & search
Bookmark panel (add/remove/jump, per-doc); document text search (pdf.js text layer) with results list + hit highlight + page jump; scanned-PDF hint state.
**Exit:** search 300-page doc < 1.5 s; bookmarks survive restart and reorder (P16 remap).

### P19 — Markup history & annotations list
Chronological markup list per doc (type, page, thumbnail, timestamp); click → jump + select annotation; delete from list; detailed history persisted from timestamps.
**Exit:** 50-markup doc lists correctly ordered; jump lands with the annotation selected.

---

## Stage G — Export & power features (P20–P24)

### P20 — Flatten & save pipeline
Overlay render per page (150/200 DPI, PNG vs JPEG q0.8 by content) → pdf-lib stamp → Save-as / Save-copy; overwrite original only behind confirm; flatten all/selected pages; **Edge + Chrome read-back test on every variant**.
**Exit:** annotated test PDF flattened → opens in Edge with identical visual; file size delta documented; original file byte-identical when untouched.

### P21 — Print, share, compress, exports
Print via flatten→temp→shell print verb; OS share; compress (low/high image re-encode with before/after size report); export page subset; text-review export (.txt/.csv of quoted annotations).
**Exit:** print dialog opens with correct doc; 20 MB scan compresses ≥ 40% with readable quality; .csv export opens in Excel correctly.

### P22 — Document builder
Multi-doc merge screen: pick docs/pages, drag to arrange, mixed page sizes handled, save merged (sidecar state migrates with pages).
**Exit:** merge 3 docs incl. annotated pages → annotations intact post-merge; Edge read-back passes.

### P23 — Measurement suite (was Pro — free, R1)
Calibrate-to-scale dialog (known length → unit scale, units mm/cm/in/ft/pt); length, polylength, rect area, polygon area with live labels; measurement list per doc.
**Exit:** calibrate 10 cm reference → measured 10.0 ± 0.5%; label style matches P3 references; persists + flattens.

### P24 — Pro tools sweep (was Pro — free, R1)
Digital protractor (angle-snap ink overlay), hyperlinks (text→URL/page/area), stamps + markup library (save/reuse any markup), redaction (true content removal behind flatten), snapshot (region → clipboard), document tags + filter, custom keyboard shortcuts.
**Exit:** each feature has a passing click-through script in `replica/test-plan.md`; redaction output shows no recoverable text underneath.

---

## Stage H — Optimization, QA & ship (P25–P30)

### P25 — Performance pass (R4 gate)
Profile everything against the budget: cold start, first paint, ink latency, 500-page doc, idle RAM; fix top offenders (worker tuning, render caching, thumbnail limits, DB batching); dpr-1.25 and integrated-GPU specifics.
**Exit:** every budget row in architecture.md green, measured and logged in `replica/perf-report.md`.

### P26 — QA (replica-test)
Test plan from flows F01–F12 (happy + edges); Playwright e2e for IPC-driven flows where possible, scripted click-throughs for the rest; bug reports with severity + evidence.
**Exit:** all must-flows pass; zero open critical bugs; `replica/bug-report.md` populated.

### P27 — Parity check (replica-diff)
Score `features.csv` clone column honestly; layout-diff screenshots vs P3 references (colour-agnostic); list gaps in build order.
**Exit:** parity score computed by parity.py; must-priority gaps = 0 (or consciously deferred with reason).

### P28 — Market fixes (replica-entrepreneur)
Mine real Drawboard user reviews (Store, Reddit, G2) for top hates/missing features; verbatim + linked quotes; turn top 3 into implemented fixes in Inkdesk.
**Exit:** review digest in `replica/entrepreneur.md`; ≥ 3 fixes shipped and tested.

### P29 — Rebrand (replica-brand)
Name candidates with trademark/domain/handle checks; original palette (contrast-checked), logo brief, voice guide; sweep codebase for any Drawboard strings/assets (sweep.py).
**Exit:** sweep clean; brand pack in `replica/brand/`; app renamed everywhere.

### P30 — Package & ship (replica-deploy)
NSIS installer (update-safe, per-user), app icon, versioning; installer < 25 MB (budget); smoke-test install on a clean Windows user account; landing page + store-listing text (replica-launch) if distributing.
**Exit:** clean-machine install → open → ink → flatten → uninstall leaves no residue; artifact at `E:\drawboard-clone\dist\`.

---

## Standing rules during execution

1. One phase = one branch-free commit series; never start P(n+1) with P(n) exit check red.
2. Perf budget is part of definition-of-done from P4 onward (log numbers, don't vibe it).
3. REA only per R5 policy; notes in `replica/rea-notes/`, never shipped.
4. Any deviation from this plan (stack change, feature cut) updates this file first, code second.
5. Anshu reviews at stage boundaries (A→H) — demo screenshot + exit checks, then continue unless he redirects.
