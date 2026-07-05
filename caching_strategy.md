# HandicapLab API Caching Strategy

This strategy outlines caching rules to balance API responsiveness and data freshness in production.

---

## 1. Caching Strategy Rules

### Dynamic Content: NO CACHE
- **Resource:** Live Predictions, Active Signals, Under-evaluation results.
- **Rule:** Set `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`.
- **Reason:** Model calculations and real-time odds shift continuously; stale calculations degrade trading ROI metrics.

### Historical / Stable Content: CACHE ENABLED
- **Resource:** Standings, completed historical matches, league metadata, team ratings.
- **Rule:** Cache results in-memory or via CDN.
- **Stale-While-Revalidate:** Standings can be cached for up to 6 hours (`max-age=21600, stale-while-revalidate=3600`).
- **League Metadata:** Static config registers can be cached indefinitely (1 year).
