# Parity check (P27 — replica-diff)

```
Parity: 86.5 / 100

features 86.5  (65 counted, must-haves 29 of 29 done)

By area, weakest first
- reorderable)                   0.0  (1 features)
- org                            0.0  (1 features)
- sync                           0.0  (2 features)
- meta                           0.0  (1 features)
- ai                             0.0  (1 features)
- convert                        0.0  (1 features)
- hardware                       0.0  (1 features)
- platform                       0.0  (1 features)
- input                         75.0  (2 features)
- tools                         80.0  (4 features)
- insert                        83.3  (10 features)
- edit                          88.2  (8 features)
- draw                          92.6  (10 features)
- viewer                       100.0  (7 features)
- export                       100.0  (1 features)
- security                     100.0  (1 features)
- notes                        100.0  (2 features)
- nav                          100.0  (2 features)
- save                         100.0  (6 features)
- ui                           100.0  (3 features)

Missing, in build order
- [should] draw: Text Cleaner (remove text-review marks), deferred  (Spotted in Review row closeup; removes highlight/underline/squiggly from text)
- [could] ai: Drawboard AI, deferred  (Their service)
- [could] convert: Office (Word) to PDF conversion, deferred  (Local converter possible later)
- [could] edit: Align/distribute selection, deferred
- [could] edit: Z-order control, deferred  (Bring forward/back)
- [could] hardware: Surface Dial integration, deferred  (Generic Windows radial API possible)
- [could] input: Custom keyboard shortcuts, deferred  (Rebindable)
- [could] insert: Equation insert (LaTeX), deferred  (π icon, Pro-dot in original; free here (R1) — render via MathML/KaTeX subset)
- [could] insert: Image from Camera, deferred  (No camera workflow on desktop — file picker covers it)
- [could] insert: Insert callout, deferred  (Pointer + box; flag for review)
- [could] meta: Accounts/licensing/subscription tiers, deferred  (Clone is free/local)
- [could] org: Tags on documents, deferred  (Filter recents by tag)
- [could] platform: Web/iOS/Android versions, deferred  (Desktop only per scope)
- [could] reorderable): Favorites toolbar (dockable, Free (7 tools) / Pro unlimited  (no)
- [could] sync: 3rd-party cloud sync (OneDrive/Dropbox/Drive), deferred  (Local-first; OS folder sync works anyway)
- [could] sync: Store+Share real-time collaboration, deferred  (Owned network — needs own backend if ever)
- [could] tools: Snapshot (region to clipboard), deferred

Fix in the matrix
- line 23: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 45: priority 'ui' is not must/should/could, counted as could
- line 45: clone 'Free (7 tools) / Pro unlimited' is not yes/partial/no/skip, counted as no
- line 49: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 50: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 51: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 52: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 53: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 57: priority 'skip' is not must/should/could, counted as could
- line 57: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 58: priority 'skip' is not must/should/could, counted as could
- line 58: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 59: priority 'skip' is not must/should/could, counted as could
- line 59: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 60: priority 'skip' is not must/should/could, counted as could
- line 60: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 61: priority 'skip' is not must/should/could, counted as could
- line 61: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 62: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 63: priority 'skip' is not must/should/could, counted as could
- line 63: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 64: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 65: clone 'deferred' is not yes/partial/no/skip, counted as no
- line 66: priority 'skip' is not must/should/could, counted as could
- line 66: clone 'deferred' is not yes/partial/no/skip, counted as no
```

Deferred consciously (with reasons in features.csv notes): Surface Dial, tags, custom
shortcuts, align/distribute, snapshot UI, equation, text-cleaner, callout styling,
multi-window, everything cloud/AI/platform (out of scope by R1/R6).

Must-haves: **all done.** Score 86.5/100 weighted by must/should/could.
