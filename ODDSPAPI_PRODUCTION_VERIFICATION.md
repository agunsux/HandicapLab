# ODDSPAPI PRODUCTION CREDENTIAL & LIVE DATA VERIFICATION REPORT

**Date:** 2026-08-15T09:21:11Z  
**Type:** READ-ONLY — No secrets modified, no code changed, no commit/push/deploy  
**Script:** ``npm run verify:oddspapi-production`` (scripts/verify-oddspapi-production.mjs)  
**JSON Output:** data/verification/oddspapi_production_verification.json

---

## FINAL DECISION

```
F — VERIFICATION_BLOCKED
```

The Vercel Production credential `ODDS_PAPI_KEY` EXISTS (Encrypted, Production+Preview, set 17 days ago)
but is EMPTY in all local environment files. A live authentication test cannot be executed locally
without the key value. The key may be valid or invalid.

---

## 1. ENVIRONMENT STATUS

| Environment | ODDS_PAPI_KEY Status | Evidence |
|---|---|---|
| Local .env | EMPTY | ODDS_PAPI_KEY="" confirmed by script |
| Local .env.production | ABSENT | Key name not present (older Vercel pull) |
| Local .env.production.local | EMPTY | Vercel CLI redacts to "" |
| Local .env.production.pull | PRESENT | Key name present; value "" = Vercel redaction |
| Local .env.production.vercel | PRESENT | Key name present; value "" = Vercel redaction |
| Vercel Production | PRESENT (Encrypted) | vercel env ls: ODDS_PAPI_KEY Encrypted Production Preview, 17d ago |

NOTE: Vercel CLI always redacts encrypted secrets to "" in pulled env files.
A value of "" does NOT mean the secret is empty in Production.
The authoritative source is vercel env ls, which confirms the key EXISTS.

---

## 2. CREDENTIAL PRESENCE

```
Vercel Production: PRESENT (Encrypted, set July 29 2026)
Local environment: EMPTY (Vercel CLI redaction — not truly empty in Production)
```

This is an environment mismatch, not a missing credential.

---

## 3. AUTHENTICATION STATUS

```
AUTH STATUS: VERIFICATION_BLOCKED (AUTH_EMPTY locally)
```

Key is empty locally — live test not possible.

| Test | URL | HTTP | Result |
|---|---|---|---|
| .com/v1 (production client) | https://api.oddspapi.com/v1/sports (x-api-key header) | NOT_TESTED | Key unavailable |
| .io/v4 (config+scripts) | https://api.oddspapi.io/v4/sports?apiKey=KEY | NOT_TESTED | Key unavailable |

### Base URL Discrepancy (Critical)

| File | Base URL | Auth Method |
|---|---|---|
| src/services/api.ts (production oddsPapi client) | https://api.oddspapi.com/v1 | x-api-key header |
| src/lib/data/providers/core/config.ts | https://api.oddspapi.io/v4 | apiKey query |
| src/scripts/p1_auth_probe.ts | https://api.oddspapi.io/v4 | apiKey query |

These may be different APIs. The production client uses .com/v1 but the auth probe uses .io/v4.

### Prior Authentication Evidence

From artifacts/audit-2026-08-10-four-provider.md:
- OddsPAPI: HTTP 401 INVALID_API_KEY on BOTH api.oddspapi.io and api.the-odds-api.com
- Key was set July 29 (before this audit) — key was invalid as of Aug 10

---

## 4. REAL ODDS AVAILABILITY

```
Fixtures: 0 (not tested — key empty locally)
Odds records: 0
```

---

## 5. BOOKMAKER COVERAGE

| Bookmaker | Status |
|---|---|
| Pinnacle | UNKNOWN |
| Circa | UNKNOWN |
| SBO/SBOBET | UNKNOWN |

---

## 6. MARKET COVERAGE

| Market | Key | Status |
|---|---|---|
| Moneyline | h2h | UNKNOWN |
| Asian Handicap | spreads | UNKNOWN |
| Over/Under | totals | UNKNOWN |
| BTTS | btts | UNKNOWN |

---

## 7. TIMESTAMP SEMANTICS

Not testable. Schema supports: last_update (market level), commence_time (event level).

---

## 8. FIXTURE LINKAGE

| Metric | Value |
|---|---|
| OddsPAPI fixtures tested | 0 |
| Matched to local DB | 0 |
| Match rate | N/A |

STRUCTURAL BLOCKER: wh_closing_lines = 0 rows. No real OddsPAPI data ever ingested into DB.
This blocker persists independently of authentication status.

---

## 9. MODEL SNAPSHOT LINKAGE

| Metric | Value |
|---|---|
| Fixtures tested | 0 |
| Model snapshot matches | 0 |

STRUCTURAL BLOCKER: 490 predictions in DB are SYNTHETIC (5 probability vectors). No settled predictions.

---

## 10. C3 READINESS CHECKLIST

| # | Check | Status |
|---|---|---|
| 1 | Production credential present | PASS (Vercel Encrypted 17d ago) |
| 2 | Authentication succeeds | UNKNOWN |
| 3 | Real odds returned | UNKNOWN |
| 4 | Bookmaker identity available | UNKNOWN |
| 5 | Market identity available | UNKNOWN |
| 6 | Line identity available | UNKNOWN |
| 7 | Timestamp available | UNKNOWN |
| 8 | Fixture mapping works | FAIL (no OddsPAPI data in DB) |
| 9 | Model snapshot mapping possible | FAIL (synthetic only) |
| 10 | No synthetic odds required | UNKNOWN |

```
C3 STATUS: VERIFICATION_BLOCKED
```

---

## 11. BLOCKERS (RANKED)

### Blocker 1 — VERIFICATION_BLOCKED (primary)
Key exists in Vercel Production but EMPTY locally.
Cannot authenticate. Must retrieve key value or use Production smoke test.

### Blocker 2 — AUTH_INVALID (historical evidence, unresolved)
Aug 10 audit confirmed HTTP 401 INVALID_API_KEY on both hosts.
Key was set July 29. As of Aug 10 it was invalid. Current status unknown.

### Blocker 3 — BASE URL AMBIGUITY (structural)
Two competing base URLs: api.oddspapi.com/v1 (production client) vs api.oddspapi.io/v4 (config/probes).
Different auth schemas. Must confirm which host and schema are correct.

### Blocker 4 — ZERO REAL ODDS IN DB (structural, C3-critical)
wh_closing_lines = 0. odds_snapshots = 1040 SYNTHETIC rows.
Even with AUTH_VALID, C3 cannot run without real ingested closing line data.

### Blocker 5 — SYNTHETIC PREDICTIONS (structural, C3-critical)
490 predictions in DB are synthetic. No real settled picks.
Model snapshot linkage is impossible without running the real prediction pipeline.

---

## 12. RECOMMENDED NEXT ACTIONS

### Immediate: Confirm Production key validity

Option A — Production smoke test (no code change needed):
```
GET https://<your-production-vercel-url>/api/health/dependencies
```
Check if oddspapi shows healthy/unhealthy in the response.

Option B — Retrieve key locally for testing:
```bash
# From OddsPAPI dashboard, get the current active key
# Place in .env.local (gitignored):
echo "ODDS_PAPI_KEY=<key>" >> .env.local
npm run verify:oddspapi-production
```

### If AUTH_INVALID: Rotate the key
```bash
npx vercel env rm ODDS_PAPI_KEY production
npx vercel env add ODDS_PAPI_KEY production
# Re-deploy for change to take effect
```

### After AUTH_VALID: Resolve structural blockers
1. Run /api/cron/odds and verify it writes real data to wh_closing_lines
2. Verify Pinnacle bookmaker appears under key "pinnacle" in odds response
3. Run model prediction pipeline against real fixtures
4. Re-run: npm run verify:oddspapi-production

---

## 13. VERIFICATION COMMAND

```bash
npm run verify:oddspapi-production
# Runs: node scripts/verify-oddspapi-production.mjs
# Output: data/verification/oddspapi_production_verification.json
# Never logs API key values
```

---

## SUMMARY TABLE

| Layer | Question | Answer |
|---|---|---|
| A | Vercel key exists | YES — Encrypted, Production+Preview, set 17d ago |
| B | Key is valid | UNKNOWN — Local empty, prior audit (Aug 10) showed 401 |
| C | OddsPAPI returns real odds | UNKNOWN — Auth not testable locally |
| D | Odds link to fixtures | FAIL — No OddsPAPI data ever ingested to DB |
| E | Odds link to model predictions | FAIL — All predictions are synthetic |
| Final | C3 readiness | VERIFICATION_BLOCKED |
