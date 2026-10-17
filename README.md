# Inkdesk

A free, local-first **PDF markup + notes app for Windows** — a clean-room rebuild of the
Drawboard PDF experience. Every feature unlocked, no subscriptions, no accounts, no ads.

**Status: planning — architecture and 30-phase roadmap are in `replica/`. Build starts at P1.**

## Why

Drawboard PDF is the best markup app on the Microsoft Store — and it locks its best tools
(measurement, document builder, unlimited signatures, templates, compression) behind
subscription tiers. Inkdesk rebuilds the whole experience as it should be: **everything free,
everything offline, everything yours.**

## What it is

| | |
|---|---|
| Platforms | Windows 10/11 (desktop) |
| Stack | Tauri 2 + React + TypeScript · pdf.js · perfect-freehand · pdf-lib · SQLite |
| Model | 100% local — no accounts, no cloud, no telemetry |
| License | MIT |

### Highlights

- Pen + highlighter + eraser with real pressure-sensitive ink (stylus-first, palm rejection)
- Radial menu + dockable favorites toolbar — Drawboard's signature tool UX
- Text review markup (highlight / underline / strikeout / squiggly) + export to .txt/.csv
- Shapes, lines with engineering dash styles, notes, textboxes, callouts, signatures, images, audio notes
- Page management: grid view, reorder by drag, insert/rotate/delete, document builder (merge)
- Measurement suite with calibrate-to-scale, digital protractor, area tools
- Bookmarks, full-text search, night mode, tabs, markup history
- Blank note documents with grid/line/dot templates
- Flatten, compress, print, export — with your original files always left untouched

## Docs

| file | contents |
|---|---|
| [`replica/recon.md`](replica/recon.md) | reverse-engineered map of the original: screens, flows, data model |
| [`replica/features.csv`](replica/features.csv) | 62-feature parity matrix (must / should / could) |
| [`replica/architecture.md`](replica/architecture.md) | stack, schema, IPC surface, performance budget |
| [`replica/PLAN.md`](replica/PLAN.md) | the 30-phase build roadmap (P1–P30) |
| [`replica/schema.sql`](replica/schema.sql) | SQLite DDL |

## Clean-room statement

Inkdesk is built **behaviorally, not genetically**: features and interaction patterns are
reimplemented from public documentation, store listings, and observed behavior. No source
code, decompiled artifacts, logos, icons, artwork, or marketing copy from the original app
is used or included. Reference screenshots are kept out of this repository on purpose.

Drawboard is a trademark of Drawboard Pty Ltd. Inkdesk is an independent project and is not
affiliated with, endorsed by, or connected to Drawboard Pty Ltd.

## Roadmap

P1–P3 foundation → P4–P6 reader → P7–P8 pressure ink core loop → P9–P10 radial menu + favorites
→ P11–P15 full markup toolkit → P16–P19 document management → P20–P24 export pipeline +
measurement suite → P25–P30 performance, QA, parity check, rebrand, installer.

See [`replica/PLAN.md`](replica/PLAN.md) for per-phase exit criteria.
