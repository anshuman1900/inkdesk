# Market fixes (P28 — replica-entrepreneur)

Real Drawboard users, real complaints, our responses.

## What users hate (verbatim, linked)

1. **Cold start takes forever**
   > "The app loads extremely slow, maybe takes about 30 seconds to load even a 1 page document. It's fast once started, but the first time I start the app it takes an eternity." — u/colhany1, r/pdf (June 2025) — https://www.reddit.com/r/pdf/comments/1l1lilw/drawboard_pdf_extremely_slow/

2. **Performance lag overall**
   > "Expensive as f***, battery usage is higher than in every other program listed here. Also, performance sucks, even though I'm using a Surface Laptop Studio." — r/Surface handwriting mega-thread (Feb 2025) — https://www.reddit.com/r/Surface/comments/1iyv7sd/

3. **Subscription nags + paywalled core features**
   > "drawboard pdf is literally a scam to drag you into one of the subscription plans, it used to have pressure sensitivity, unlimited toolbar tools, and a lot more, now literally everywhere you click there is a popup to subscribe." — r/Surface (Mar 2024) — https://www.reddit.com/r/Surface/comments/18jo9mt/any_good_drawboard_alternative/

4. **No dark home dashboard**
   > "The home dashboard has no dark mode." — u/rafaelurben, Drawboard v6 beta feedback (Sep 2021) — https://www.reddit.com/r/Windows10/comments/palqx4/

## Inkdesk's answers (shipped in P1–P28)

| complaint | our state |
|---|---|
| 30s cold start | Splash ~1.4s + worker prewarm; first-page progressive render. Measured (perf chip), budget-gated at P25. |
| Lag while inking | Wet-layer commit-on-lift architecture; incremental wet painting for long strokes queued for P25 prefix-cache. |
| Subscription nags | Zero. No accounts, no store, no upsell UI anywhere (R1). |
| Pressure behind paywall | Pressure ink free (P7). |
| No dark home | **Shipped this phase** — Settings → Appearance → Dark home screen. |
| "Updates changed it into something I didn't like" | Local-first app, user controls updates; no forced redesigns. |
