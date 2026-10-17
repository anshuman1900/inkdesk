# Recon map — Drawboard PDF + Notes (Windows desktop clone)

**Original:** Drawboard PDF + Notes, Drawboard Pty Ltd, Microsoft Store (9wzdncrfhwqt), 4.6★ / 989 ratings, released 2013, ~300 MB, in-app purchases. #1 productivity app on the MS Store, 3M+ users.
**Target:** Windows desktop clone (clean-room). Project root: `E:\drawboard-clone`.
**Sources:** MS Store listing, drawboard.com (product/pricing/campaign pages), support.drawboard.com (Plans & Benefits, Radial Menu, View & Layout, Favorites toolbar, Canvas section). Reference screenshots in `replica/screens/` (store slides). No decompiling, no bundle reading, no network capture — behavioral recon only.

## Scope (confirmed by Anshu)

- **App/slice:** the local, single-user app: PDF viewer + full markup toolkit + note-taking (blank docs, grids/templates) + document management (merge, pages, bookmarks, print/export).
- **Everything free.** No subscriptions, no tier locks, no trials, no accounts, no ads — every feature Drawboard gates behind Pro (measure, doc builder, unlimited signatures, templates…) ships unlocked.
- **Look & feel target:** same layout language and vibe as Drawboard (radial menu, dockable favorites bar, circular colored tool icons, dark chrome, touch-first) rebuilt with original assets — clean-room: never their logo, icons, copy or artwork.
- **Out of scope (their owned network):** Store+Share cloud, real-time multi-user sync, accounts/licensing, Drawboard Projects (B2B), Drawboard AI, MS Store billing.
- **Who for:** Anshu's product — students/notetakers and PDF reviewers who want a fast, free, offline markup app.

## Step 3 — Screen inventory

| ID | screen | how you get there | purpose | key components | states seen/expected |
|----|--------|-------------------|---------|----------------|----------------------|
| S01 | Library / home | app launch | open/recent documents | recent list, "Open PDF", "New blank doc", sample docs | empty (no recents), many recents |
| S02 | Tab bar | 2+ docs open | switch/close open documents | doc tabs, + button, close x | 1 tab, many tabs (overflow), dirty indicator |
| S03 | Canvas | open doc | read + mark up pages | page view, zoom, pan (hand), page indicator, nav-history button | fit-width, fit-page, zoomed, night mode, loading large page |
| S04 | Radial menu | Settings→View&Layout→"Use radial menu" (toggle) | fast tool switching at pointer | 8 slots: Pan, Select, Pen×2, Highlighter, Eraser, Text review, More; sub-arrows open variants | on/off, docked position, long-press variants |
| S05 | Favorites toolbar | default visible / Toolbar menu → Save as Favorite Toolbar | user's pinned tool configs | tool chips, + add, drag-to-add, trash, multiple named toolbars, presets (Construction/Architecture), import; dock left/right/top or floating (drag handle) | empty, default 7-tool limit (free tier in original), unlimited (pro), multiple toolbars |
| S06 | "Choose new tool" panel | + on toolbar / tool category | pick a tool for toolbar or canvas | categories: Draw, Insert, Measure, Select, Pro Tools; circular colored tool icons | category pages, disabled (pro-locked in original) |
| S07 | Tool properties | arrow next to any tool | edit color/width/opacity/size, pressure | color swatches + picker, width slider, opacity slider, pressure toggle, save-as-preset | defaults, edited, saved preset |
| S08 | Pages grid | pages button on canvas | view/rearrange/insert/manipulate pages | thumbnails, drag-drop reorder, insert blank/image, rotate, delete, duplicate | 1 page, 100+ pages, drag in progress |
| S09 | Insert menu | Insert category | notes, text, callouts, signatures, images, audio | note (sticky), textbox, callout, signature (draw/type, bank), image from file/camera, audio note, hyperlink, stamp | signature bank empty/full, camera absent (desktop: file only) |
| S10 | Measurement panel | Measure category | calibrated length/area markup | calibrate-to-scale dialog, length, polylength, rect area, polygon area, protractor overlay (ink snaps to angle), units | uncalibrated (prompts), calibrated |
| S11 | Document options | top bar doc menu | save/flatten/print/share/export | Save (override), Save as new, Flatten annotations, Reduce file size (low/high), Print, Share (OS), Export text review (.txt/.csv), Export annotated pages | unsaved changes, flatten confirm, compress progress |
| S12 | Bookmarks panel | bookmark icon | jump to bookmarked pages | bookmark list, add/remove | empty, many |
| S13 | Search panel | search icon | find text in document | query field, results list, page jump | no results, many results |
| S14 | Annotations/markup history | history icon | list of markups, undo/redo, detailed history | chronological markup list, tap to select/zoom to annotation | empty, long list |
| S15 | Document Builder | tools menu | merge/reorder/arrange documents | doc list, page picker, drag pages between docs, save merged | 1 doc, many docs |
| S16 | New blank document | home / + new | note-taking doc | size presets, page color, orientation, page count, grid/line template overlay | each option state |
| S17 | Settings | gear | view & layout (radial on/off, nav history, page indicator), layout options, favorites toolbox, language, stylus vs touch | toggles, sections | each toggle |
| S18 | Selection menu | select tool active | act on selection | rect/text/lasso select, laser pointer; move, delete, copy, z-order | nothing selected, multi-selected |
| — | Store+Share / collaborators | account | cloud docs, real-time co-markup | collaborators panel (seen in store slide) | **SKIP — owned network** |

## Step 4 — User flows

```
F01 Open and read (core)          S01 → S03
    open from recents/file picker → tabs → pan/zoom pages → page indicator jump
    edge: corrupt PDF, 300-page doc, password-protected PDF
F02 Ink markup (THE core loop)    S03 → S04/S05 → S07 → S03
    pick pen (radial or favorites) → set color/width → draw with pressure → undo → keep drawing
    count to first ink after open: ~2 clicks (beat this)
    edge: palm touch while writing (stylus/touch toggle), very fast strokes (latency)
F03 Text review                   S03 → select text → highlight/underline/strike/squiggly → S11 export
    edge: scanned PDF (no text layer) → freehand highlighter fallback
F04 Note on a PDF                 S03 → S09 → note/textbox/callout → type → place → save
    edge: note off-page bounds, very long text
F05 Sign a document               S03 → S09 → signature → draw/type → save to bank → place → S11 save
    edge: signature bank empty, multiple signatures
F06 Shapes and lines              S03 → shape tool → drag on canvas → S07 edit style/line style
    edge: cloud/polygon with many points, snap
F07 Manage pages                  S03 → S08 → reorder drag/rotate/delete/insert → S11 save as new
    edge: delete last page, reorder 100 pages
F08 Take notes from scratch       S01 → S16 (size/color/orientation/pages/grid) → S03 → ink → S11 save
    edge: template pick, 200 blank pages
F09 Find and navigate             S03 → S13 search / S12 bookmarks → jump
    edge: no text layer, no bookmarks yet
F10 Export and share              S03 → S11 → flatten / compress / print / OS share / export text review
    edge: flatten is destructive → confirm; compress quality choice
F11 Measure a drawing (phase 2)   S03 → S10 → calibrate against known length → length/area → units
    edge: re-calibrate, wrong units
F12 Merge documents (phase 2)     S15 → pick docs/pages → arrange → save merged
    edge: huge docs, mixed page sizes
```

## Step 5 — Components

- **Tool chip** (favorites bar slot): icon, active state, variant arrow; drag-reorder, drag-to-trash.
- **Radial menu**: 8 fixed slots + center; sub-flyouts per slot; toggled in settings.
- **Properties popover**: color swatches, custom picker, width/opacity sliders, pressure toggle; per-tool persistence.
- **Page canvas**: zoom/pan, fit modes, night mode (inversion), page indicator chip, nav-history back button.
- **Thumbnail card** (pages grid): preview, drag handle, rotate/delete/insert affordances.
- **Annotation renderers**: ink stroke (pressure-varying, tapered), highlighter (multiply blend), text review (4 styles), shapes (7 types + dash styles), note/textbox/callout, image, signature, audio pin, measurement label.
- **Tab bar**, **panels** (bookmarks/search/history: left-dockable list), **menus** (doc options, insert).
- **Dialogs**: new blank doc, calibrate scale, flatten confirm, compress.
- **Signature bank**, **markup/stamp library** (saved reusable annotations).
- **Toolbar manager**: multiple named toolbars, presets, import/export.

## Step 6 — Inferred data model

```
Document    id, path, title, page_count, created_at, modified_at, last_opened_at,
            night_mode?, zoom_state?, open_tabs order          (evidence: S01 recents, S02 tabs)
Page        doc_id, index, rotation, size (w,h), thumbnail     (evidence: S08 rotate, page sizes)
Annotation  id, doc_id, page_index, type (ink|highlighter|text_review|shape|note|textbox|
            callout|signature|image|audio|measurement|stamp|hyperlink|redaction),
            geometry (points/rect), style {color, opacity, stroke_width, dash, font},
            z_order, created_at, author_local, data (text, image_ref, audio_ref, measurement)
            (evidence: every markup tool; z-order & history in Pro tier table)
ToolPreset  id, tool_type, style, is_favorite, toolbar_id, order  (evidence: S05/S07)
Toolbar     id, name, chips[toolPreset], dock_position         (evidence: multiple favorites toolbars)
Signature   id, strokes/png, name                              (evidence: signature bank, 2-limit free)
Bookmark    id, doc_id, page_index, label                      (evidence: S12)
TextReview  subtype of annotation: highlight|underline|strikeout|squiggly + quoted text,
            exportable to .txt/.csv                            (evidence: store listing, tier table)
Measurement calibration {scale_factor, units}, kind (length|polylength|rect_area|poly_area)
                                                               (evidence: measure tools)
Template    kind (grid|lines|dots), spacing, overlay color     (evidence: grids & lines, S16)
MarkupHistoryEntry doc_id, annotation_id, action, timestamp   (evidence: annotations history)
Settings    radial_menu_on, stylus_touch_mode, language, layout prefs, theme
All guesses marked: tab layout, zoom persistence, tags schema (Pro: tags) — confidence medium.
```

## Step 7 — Feature matrix

See `replica/features.csv` (feature, area, priority, original_tier, clone, notes).

## Step 8 — What cannot be cloned

| item | why |
|------|-----|
| Store+Share cloud + real-time co-markup | their network/service; needs own backend if ever built |
| Drawboard Projects (B2B platform) | separate owned product |
| Drawboard AI | their service; could substitute own later |
| 3M user base, brand, store listings, marketing copy | owned assets |
| Microsoft Store licensing/billing rails | platform-specific |
| Surface Dial deep integration | hardware pairing; generic Windows radial-controller support is possible (could) |
| Office conversion backend | their service; local LibreOffice-based conversion possible later (could) |

## Step 9 — Size it

- Essentials slice (must rows in matrix): ~18 screens/panels, 10 flows, 12 entities. Hard parts: **pressure ink rendering at 240Hz without lag**, **annotation model saved into real PDF files (appearance streams / PDF-1.7 markup annots) that other readers can open**, night mode, large-document performance (300 MB app; 1000+ page docs), stylus/palm discrimination.
- Size: **M for the Essentials MVP (a few weeks of focused work)**, **L** if measurement + doc builder + compression land too, **XL** only if cloud sync is attempted (do not).
- Recommended stack (for /replica-architect to finalize): Tauri v2 + WebView2 (light on Anshu's low-end PC) with pdf.js rendering + a PDF write path (pdf-lib/hummus or Rust pdf engine); custom ink engine on canvas/WebGL.

## Next step

`/replica-architect` — stack + schema + route list from this map, then `/replica-build` starting with the core loop (open → ink → save).
