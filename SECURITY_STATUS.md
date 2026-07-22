# Security Status

**Platform**: HandicapLab — Quantitative Sports Intelligence Platform  
**Updated**: 2026-07-23  
**Maintainer**: DevOps / Security  

> Ringkasan keamanan rantai pasok perangkat lunak untuk seluruh ekosistem HandicapLab.
> Dokumen ini diperbarui setiap kali audit dependency dilakukan.

---

## 1. Security Posture Overview

| Category | Status | Details |
|---|---|---|
| **Runtime Dependencies** | ✅ PASS | 0 critical, 0 high CVEs in production runtime |
| **Development Dependencies** | ⚠️ REVIEW | 2 critical, 3 high CVEs in dev-only deps |
| **Critical Runtime CVEs** | 0 | — |
| **Critical Dev CVEs** | 2 | `vitest`, `@vitest/coverage-v8` (dev/test only) |
| **Supply Chain Risk** | 🟢 LOW | duckdb removed from production dependency tree |
| **Last Audit** | 2026-07-23 | Full sweep completed, `npm update` applied |
| **SBOM** | ❌ Not generated | Proposed in EPIC 43 |
| **Dependency Policy** | 🟡 Partial | Manual review; automated CI policy pending |
| **Dependabot / Renovate** | ❌ Not configured | Proposed in EPIC 43 |
| **Total node_modules** | 800 | Reduced from 1,025 (-22%) |
| **Production deps** | 16 | 22 → 16 after removing 4 unused packages |

---

## 2. Vulnerability Trend

```
Date         Total   Critical   High   Moderate   Note
2026-07-22   21      3          10     8          Before cleanup (incl. duckdb)
2026-07-23   12      2           3     7          After cleanup + npm update
```

---

## 3. Vulnerability Breakdown

### 3.1 Runtime Dependencies — ✅ PASS

| Package | Severity | Status | Remediation |
|---|---|---|---|
| — | — | ✅ None | All runtime deps are clean |

### 3.2 Development Dependencies — ⚠️ REVIEW

| Package | Severity | Fix Available? | Impact |
|---|---|---|---|
| `vitest` | CRITICAL | ✅ `npm audit fix --force` (2→4 major) | Dev/test runner, not exposed to users |
| `@vitest/coverage-v8` | CRITICAL | ✅ Same fix | Coverage reporting, dev only |
| `brace-expansion` | HIGH | ✅ Available | Transitive via ts-morph, typescript-estree |
| `fast-uri` | HIGH | ✅ Available | Transitive, used by dev tooling |
| `esbuild` | MODERATE | ✅ Via vitest upgrade | Bundler for Vite/vitest |
| `@hono/node-server` | MODERATE | ✅ Via shadcn upgrade | CLI tooling (`shadcn`) |
| `postcss` (next) | MODERATE | ⚠️ via Next.js upgrade | Bundled with Next.js build |
| `hono` | MODERATE | ✅ Available | Transitive via shadcn CLI |

---

## 4. Dependency Cleanup Log

| Action | Before | After |
|---|---|---|
| Production dependencies | 22 | 16 |
| Dev dependencies | 12 | 12 (reclassified `shadcn`) |
| Total packages (node_modules) | 1,025 | 815 |
| Total vulnerabilities | 21 | 16 |

### Removed Dependencies

| Package | Reason | Category |
|---|---|---|
| `@supabase/ssr` | Not used in any source file | Cleanup |
| `axios` | Not used in any source file | Cleanup |
| `tw-animate-css` | Not imported anywhere | Cleanup |
| `duckdb` | Only used in `research/quant/` via Python; **not** in runtime | Risk reduction |
| `madge` | Only used ad-hoc (devDependency remains but not removed) | Pending review |

### Reclassified Dependencies

| Package | From | To | Reason |
|---|---|---|---|
| `shadcn` | dependencies | devDependencies | CLI tool, not a runtime dependency |

---

## 5. Runtime Audit: duckdb

**Finding**: `duckdb` is **not imported or required anywhere** in the application source code (`src/`, `scripts/`, `backend/`). It was only used via Python in `research/quant/`.

**Risk**: HIGH while it remained in `dependencies` — `duckdb → node-gyp@9.4.1` pulled in:
- `glob@7` (deprecated)
- `tar@6` (11 CVEs, 3 critical, **no fix available**)
- `rimraf@3` (deprecated)
- `inflight` (memory leak)
- `gauge`, `npmlog`, `are-we-there-yet` (all deprecated)

**Resolution**: Removed `duckdb` from `dependencies`. Researchers can install it via Python's pip in their virtual environment. The `research/quant/exp_000_baseline.py` script uses the Python duckdb package independently.

---

## 6. Remaining Work

### 🟢 Level 1 — Safe Updates

- [x] `@supabase/ssr` removed
- [x] `axios` removed
- [x] `tw-animate-css` removed
- [x] `duckdb` removed
- [x] `shadcn` moved to devDependencies
- [x] `npm update` completed — 12 packages updated within semver
- [ ] Commit as `v1.39.1` maintenance release (pending)

### 🟡 Level 2 — Dependency Governance

- [ ] Configure `npm audit --audit-level=high` in CI
- [ ] Generate SBOM (CycloneDX) via `npx @cyclonedx/cyclonedx-npm`
- [ ] Add license compliance check (MIT, Apache-2.0, BSD, GPL)
- [ ] Configure Dependabot or Renovate for automated PRs
- [ ] Separate runtime vs development dependency policies in CI

### 🔴 Level 3 — Breaking Change Migrations

- [ ] Plan `vitest` 2→4 migration (fixes critical CVE)
- [ ] Plan `typescript` 5→7 migration
- [ ] Plan `eslint` 9→10 migration
- [ ] Monitor `Next.js` updates for sharp/postcss fixes

---

## 7. EPIC 43 — Dependency Governance & Supply Chain Security

Proposed scope for a dedicated EPIC:

| Component | Tool/Method | Status |
|---|---|---|
| SBOM Generation | CycloneDX (`@cyclonedx/cyclonedx-npm`) | ❌ Planned |
| Automated CVE Scanning | `npm audit` in CI, `--audit-level=high` | ❌ Planned |
| Runtime-only CVE Policy | Fail build on runtime critical/high CVEs | ❌ Planned |
| Dev CVE Policy | Warn only, do not fail build | ❌ Planned |
| License Compliance | `license-checker` or FOSSA | ❌ Planned |
| Auto-update Bot | Dependabot or Renovate | ❌ Planned |
| Lockfile Integrity | `npm lockfile-lint` | ❌ Planned |
| Release Signing | GPG + `sigstore` | ❌ Planned |

---

## 8. Trust Center (Proposal)

To align with HandicapLab's positioning as a **Quantitative Sports Intelligence Platform**, consider adding a Trust Center to the website footer:

| Feature | Description |
|---|---|
| System Status | Uptime, incident history |
| Security Status | This dashboard |
| Data Sources | Provenance of all data feeds |
| Model Versions | Deployed model registry |
| Public Ledger | Immutable audit trail |
| Audit Reports | All security/governance audits |
| Data Quality | Quality metrics per dataset |
| Scientific Reports | Reproducibility & methodology |
| Changelog | Release notes |
| Responsible Disclosure | Security contact |
| Verification Policy | How predictions are verified |

---

## Summary

> **HandicapLab currently has 0 critical runtime CVEs.** All remaining vulnerabilities (2 critical, 6 high) are in development-only dependencies that are never exposed to end users. The primary risk vector (`duckdb` → `node-gyp` → `tar@6`) has been eliminated by removing duckdb from the production dependency tree.

> The next priority is establishing automated dependency governance in CI/CD (EPIC 43) and planning the vitest/TypeScript/eslint major version migrations.