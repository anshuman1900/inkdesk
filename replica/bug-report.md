# Bug report (P26)

## Open
- [ ] PERF-1 first-page 948–1466ms vs 600ms budget (progressive render shipped; re-measure)
- [ ] INK-1 long-stroke wet preview needs prefix-cache (P25+)
- [ ] QA-1 text-review double-click manual verification pending

## Closed (fixed during build)
- INK-0 pen invisible (touch-action + pressure≈0) — fixed 562157c, 493e683
- INK-2 ink offset from cursor (outline scaling) — fixed 21ea083
- INK-3 pen wrote in pan/select mode — fixed 044db51
- ERASE-1 single-erase-per-drag — fixed f884ae7
- ERASE-2 shapes not erasable — fixed 044db51
- UI-1 perf chip covered toolbar — fixed ff5299e
- DB-1 recents silently failed (sql:allow-execute, unixepoch) — fixed 7af9419
- BUILD-1 vite EBUSY crash on rebuild — fixed (watch ignore target/)
