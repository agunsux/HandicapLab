# HandicapLab Rate Limiting Review

This document logs rate limit enforcement bounds across the production API endpoints.

---

## 1. Rate Limiter Backend
HandicapLab leverages a database-backed distributed rate limiter targeting the `rate_limit_events` table in Supabase.

- **Storage Type:** PostgreSQL backed.
- **Auto-Cleanup:** Runs a daily cleanup query deleting events older than 24 hours.
- **Fail-Safe Fallback:** If the database is unreachable, requests are safely allowed (`return false`) to prevent blocking legitimate production traffic.

---

## 2. Configured Limits

| Endpoint | Tier / Context | Rate Limit Window | Max Requests | Identifiers |
| :--- | :--- | :--- | :--- | :--- |
| **`/api/predictions`** | Free / Starter | 60 seconds | 60 requests | User ID or Hashed IP |
| | Pro / Quant | 60 seconds | 300 requests | User ID or Hashed IP |
| **`/api/signals`** | Quant Tier Only | 60 seconds | 300 requests | User ID or Hashed IP |
| **`/api/fixtures`** | All Tiers | 60 seconds | 60/300 requests | User ID or Hashed IP |
