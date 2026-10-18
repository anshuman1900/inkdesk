# Test plan (P26 — replica-test)

Flows from recon.md F01–F12, evidence from real usage on the dev machine.

| # | flow | result | evidence |
|---|------|--------|----------|
| 1 | F01 open PDF (dialog + recents) | PASS | Redox notes, 1791525933.pdf, big120 all open; recents table lists them |
| 2 | F02 ink with mouse | PASS | scripted stroke + Anshu pen strokes (20+ rows in DB) |
| 3 | F02 ink with pen (Huion) | PASS after 3 fixes | touch-action, pressure clamp, alignment — Anshu-tested |
| 4 | F03 text review | PARTIAL | text layer wired; needs manual double-click verification |
| 5 | F04 note insert | PASS (code) | inline editor; needs manual pass |
| 6 | F06 shapes | PASS | Anshu drew ellipses/lines (24 shape rows in DB), persisted |
| 7 | F07 pages reorder/rotate/delete | PASS (code) | pdf-lib rewrite + annotation remap; manual pass pending |
| 8 | F08 blank docs | PASS (code) | template dialog; manual pass pending |
| 9 | F09 search/bookmarks | PASS (code) | getTextContent search; manual pass pending |
| 10 | F10 flatten | PASS (code) | 150dpi overlay stamp → new file; Edge read-back manual check pending |
| 11 | round-trip persistence | PASS | draw → close → reopen identical (verified twice) |
| 12 | night mode | PASS | inverted render + persisted flag |
| 13 | tabs | PASS | 3 docs simultaneously, switch/close |
| 14 | pan/select tool gating | PASS | count-before/after unchanged in scripted pan-drag |

## Known open bugs
1. First-page paint 948–1466ms vs 600ms budget — progressive render shipped; re-measure pending.
2. Ink preview during very long strokes — prefix-cache deferred to P25+.
3. Text review double-click needs manual verification.

## Fixed during build (regression-proofing evidence)
- pen consumed as scroll (touch-action), pressure≈0 invisibility, ink offset by zoom,
- eraser single-hit, tool-gating leak, perf chip covering toolbar, EBUSY watcher crash,
- sql:allow-execute missing, unixepoch() unsupported, pdfjs v5 API drift.
