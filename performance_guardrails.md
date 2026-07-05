# HandicapLab Performance Guardrails

This document outlines key guardrail settings for network latency, request sizes, and timeouts.

---

## 1. Safety Timeouts

We enforce a **10-second (10000ms)** execution timeout for all external outgoing HTTP API requests using `AbortController` signals.

- **FootyStats API client:** Timeout of 10s on matches/fixtures fetches.
- **API Football Client:** Timeout of 10s.
- **Football Data Provider:** Timeout of 10s.

---

## 2. Page & Query Boundaries

To prevent database memory saturation and unlimited execution sequences:
- **Maximum Limit Allowed:** `100` records per request.
- **Default Limit:** `50` records (fixtures/signals), `60` records (predictions).
- **Pagination Strategy:** Range-based cursor offset matching.
