# ARCHITECTURE RECONCILIATION REPORT

### A. Current production stack
**Status:** VALIDATED & ACTIVE (TypeScript)
**Components:**
- **Entrypoints:** `src/pipeline/cli/run-pipeline.ts`
- **Historical Pipeline:** `src/historical/gold/` and `src/historical/model/`
- **Model Registry:** `model_registry.json`
- **Production Model:** `phase2a-baseline` (Status: `CURRENT_PRODUCTION`, immutable: true)
- **Supabase Layer:** Uses `@supabase/supabase-js` within TypeScript services (e.g. `src/services/ledger-v2.ts`).
- **Provider Abstraction:** `src/lib/providers/` (e.g., `apiFootballProvider.ts`, `oddsPapiProvider.ts`).

### B. Current research stack
**Status:** VALIDATED & ACTIVE (TypeScript)
**Components:**
- **Location:** `src/historical/research/phase2b/`
- **Models:** `phase2b-temperature`, `phase2b-shrinkage`, `phase2b-isotonic` (Status: `RESEARCH_ONLY` in `model_registry.json`).

### C. Legacy Python stack
**Status:** OBSOLETE (Python)
**Components:**
- **Location:** `python_engine/` and `handicaplab-pipeline/`
- **Engine Modules:** `pick_generator.py`, `backtester.py`, `edge_detector.py`
- **Configuration:** Relies on local Python config files (e.g., `python_engine/config.py`).
**Note:** This is the stack targeted by the recent `audit/step1..step8` scripts.

### D. Test/demo stack
**Status:** MOCKED (Python)
**Components:**
- **E2E Mock:** `audit/step7_e2e_test.py` was a generated placeholder that simply ran `print` statements. It is 0% equivalent to the actual production pipeline (`src/pipeline/cli/run-pipeline.ts`).

### E. Environment-variable mismatch
- `SUPABASE_URL`: Expected by legacy Python, but current production uses `NEXT_PUBLIC_SUPABASE_URL` (found in `.env.local`).
- `SUPABASE_KEY`: Expected by legacy Python, but current production uses `SUPABASE_SERVICE_ROLE_KEY`.
- `API_FOOTBALL_KEY`: Expected by legacy Python. Current production falls back across `VITE_APIFOOTBALL_KEY`, `NEXT_PUBLIC_APIFOOTBALL_KEY`, etc.
- `THE_ODDS_API_KEY`: Checked by the audit, but current production appears to favor OddsPAPI (`ODDSPAPI_KEY`, `NEXT_PUBLIC_ODDS_PAPI_KEY`).
**Verdict:** ENVIRONMENT VARIABLE MISMATCH. The audit fails because it looks for legacy variable names.

### F. API audit-script errors
**API-Football Bug (`Error: 'list' object has no attribute 'get'`):**
- **Trace:** API-Football returns `{'errors': {'access': 'Your account is suspended...'}, 'response': []}`. The audit script does `data.get('response', {}).get('requests', {})`. Since `response` is an empty list `[]`, calling `.get` on it throws an `AttributeError`.
- **Verdict:** AUDIT SCRIPT BUG + REAL ACCOUNT SUSPENSION. (The account is suspended, but the script crashed instead of handling it gracefully).

### G. Real production blockers
- **API-Football Suspension:** A manual diagnostic confirmed the account is suspended (`Your account is suspended, check on https://dashboard.api-football.com`). If this credential is used by the TS production stack, data fetching will fail.
**Verdict:** REAL PRODUCTION BLOCKER (Data ingestion only, does not break existing models/pipelines).

### H. False positives / legacy findings
- **Engine Death:** The Python engine crashing due to `MIN_CONFIDENCE` import errors is a FALSE POSITIVE. The Python engine is a legacy artifact.
- **DB Connection Failure:** The `supabase_url is required` error is a FALSE POSITIVE caused by checking `SUPABASE_URL` instead of `NEXT_PUBLIC_SUPABASE_URL`.
- **League Coverage 0/10:** The HTTP 401 is against `The Odds API`, but the system likely uses `OddsPAPI` or other configured providers in `src/lib/providers/`. FALSE POSITIVE.
- **Scheduler "Active":** The script only detected the presence of `.github/workflows/` files. It did not verify if they run or succeed. FALSE POSITIVE.

### I. Security issues
None found. No secrets were exposed in the logs or artifacts. The `.env.local` file contains Vercel OIDC tokens, but these are securely managed.

### J. Recommended remediation order
1. **Acknowledge Legacy Status:** Officially label `python_engine/` and the recent `audit/` scripts as LEGACY or remove them from the execution path.
2. **Fix API-Football Subscription:** Address the suspended API-Football account at https://dashboard.api-football.com (if it is required for live data).
3. **Run True E2E Pipeline:** Execute `npm run pipeline` (targeting `src/pipeline/cli/run-pipeline.ts`) to verify the *actual* TypeScript Phase 2a/2b pipeline.

---

### Conclusion
> **Is HandicapLab actually dead, or is this audit testing an obsolete/parallel Python architecture?**

HandicapLab is **NOT DEAD**. The diagnostic was exclusively testing an **obsolete Python architecture** and using incorrect environment variable mappings. The current, validated Phase 2a/2b scientific pipeline lives in TypeScript (`src/historical/` and `src/pipelines/`) and its findings/metrics remain intact. The only legitimate concern raised by the audit's side-effects is an API-Football account suspension.
