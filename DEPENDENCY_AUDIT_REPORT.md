# Dependency Audit Report

**Date**: 2026-07-23  
**Project**: HandicapLab  
**Scope**: Transitive dependency health, security advisories, version freshness, and unused dependencies  

---

## 1. Deprecated Transitive Dependencies — Root Cause Analysis

### 1.1 glob@7 (Deprecated + Security Advisory) — Priority: HIGH

```
handicap-lab
 └── duckdb@1.4.4
      └── node-gyp@9.4.1        ← ROOT CAUSE
           └── glob@7.2.3
```

Additional `glob` versions pulled in via other paths:

| Path | glob version | Status |
|---|---|---|
| `duckdb → node-gyp → glob` | 7.2.3 | Deprecated |
| `duckdb → node-gyp → make-fetch-happen → cacache → glob` | 8.1.0 | OK (not latest but maintained) |
| `@vitest/coverage-v8 → test-exclude → glob` | 10.5.0 | Current |
| `@sentry/nextjs → @sentry/bundler-plugin-core → glob` | 13.0.6 | Latest |

### 1.2 tar@6 (Deprecated + CRITICAL Security) — Priority: CRITICAL

```
handicap-lab
 └── duckdb@1.4.4
      └── node-gyp@9.4.1        ← ROOT CAUSE
           ├── tar@6.2.1        ← 11 known CVEs, mostly critical/high
           └── make-fetch-happen@10.2.1
                └── cacache@16.1.3
                     └── tar@6.2.1 (deduped)
```

**Note**: duckdb also depends on `@mapbox/node-pre-gyp@2.0.3 → tar@7.5.19` which is the **fixed** version. The problem is exclusively `node-gyp@9.4.1` which pins to `tar@6.2.1`.

**Fix status**: No fix available — `tar@6` has no patch release. Upgrading `node-gyp` to v11+ resolves this, but that depends on `duckdb`.

### 1.3 rimraf@3 (Deprecated) — Priority: MEDIUM

```
handicap-lab
 └── duckdb@1.4.4
      └── node-gyp@9.4.1
           ├── rimraf@3.0.2
           └── make-fetch-happen → cacache → @npmcli/move-file → rimraf@3.0.2
```

### 1.4 inflight (Memory Leak) — Priority: HIGH

Transitively used by `glob@7` internals. Also deprecated by npm.

### 1.5 gauge, npmlog, are-we-there-yet (Deprecated) — Priority: LOW

All transitively pulled by `node-gyp@9.4.1`.

---

## 2. Single Point of Failure

```
duckdb@1.4.4 ──→ node-gyp@9.4.1
                    ├── glob@7.2.3         deprecated
                    ├── tar@6.2.1          11 CVEs (3 critical)
                    ├── rimraf@3.0.2       deprecated
                    ├── inflight           memory leak
                    ├── gauge              deprecated
                    ├── npmlog             deprecated
                    └── are-we-there-yet   deprecated
```

**Root cause**: `duckdb@1.4.4` pins to `node-gyp@9.4.1` which depends on EOL npm internal packages.  
**Resolution path**: Either wait for `duckdb` to update their `node-gyp` dependency, or if upstream has a newer version, update `duckdb`.

---

## 3. Security Audit Summary

| Severity | Count | Key Packages |
|---|---|---|
| **CRITICAL** | 3 | tar@6 (no fix), vitest, @vitest/coverage-v8 |
| **HIGH** | 10 | brace-expansion, fast-uri, sharp, vite, duckdb (via tar chain) |
| **MODERATE** | 8 | hono, esbuild, postcss, @hono/node-server |
| **LOW** | 0 | — |
| **Total** | **21** | |

### 3.1 Critical Vulnerability Details

| Advisory | Package | CVE Count | CVSS | Fix Available? |
|---|---|---|---|---|
| GHSA-34x7-hfp2-rc4v | tar@6 | 11 CVEs in chain | 8.8 | ❌ **No fix** |
| GHSA-5xrq-8626-4rwp | vitest | 1 | 9.8 | ✅ `npm audit fix --force` (major bump 2→4) |
| (via vitest) | @vitest/coverage-v8 | 1 | 9.8 | ✅ Same fix |

### 3.2 High Vulnerability Details

| Package | Issue | CVSS | Fix |
|---|---|---|---|
| brace-expansion | ReDoS via `{}` expansion | 5.3 | ✅ Available |
| fast-uri | Host confusion via backslash delimiter | 7.5 | ✅ Available |
| fast-uri | Host confusion via failed IDN canonicalization | 7.5 | ✅ Available |
| sharp | libvips CVEs (CVE-2026-33327, etc.) | ~8.0 | `npm audit fix --force` (breaks next) |
| vite | `server.fs.deny` bypass on Windows | 7.5 | via vitest upgrade |
| duckdb | Propagated from tar@6 chain | — | ❌ **No fix** |

---

## 4. Version Freshness (`npm outdated`)

### 4.1 Direct Dependencies — Safe to Update (within semver)

| Package | Current | Wanted | Latest | Safe? |
|---|---|---|---|---|
| @sentry/nextjs | 10.62.0 | 10.67.0 | 10.67.0 | ✅ Yes |
| @supabase/supabase-js | 2.110.5 | 2.110.8 | 2.110.8 | ✅ Yes |
| @tailwindcss/postcss | 4.3.1 | 4.3.3 | 4.3.3 | ✅ Yes |
| framer-motion | 12.41.0 | 12.42.2 | 12.42.2 | ✅ Yes |
| lucide-react | 1.21.0 | 1.25.0 | 1.25.0 | ✅ Yes |
| next | 16.2.9 | 16.2.9 | 16.2.11 | ✅ Yes |
| react | 19.2.4 | 19.2.4 | 19.2.8 | ✅ Yes |
| react-dom | 19.2.4 | 19.2.4 | 19.2.8 | ✅ Yes |
| shadcn | 4.11.0 | 4.14.0 | 4.14.0 | ✅ Yes |
| tailwindcss | 4.3.1 | 4.3.3 | 4.3.3 | ✅ Yes |
| tsx | 4.22.4 | 4.23.1 | 4.23.1 | ✅ Yes |
| eslint | 9.39.4 | 9.39.5 | 10.7.0 | ⚠️ Major bump |
| eslint-config-next | 16.2.9 | 16.2.9 | 16.2.11 | ✅ Yes |

### 4.2 Direct Dependencies — Breaking Changes Required

| Package | Current | Latest | Migration Impact |
|---|---|---|---|
| @types/node | 20.19.43 | 26.1.1 | New types, may need code changes |
| @vitest/coverage-v8 | 2.1.9 | 4.1.10 | API changes, config migration needed |
| vitest | 2.1.9 | 4.1.10 | Major version jump (2→4) |
| typescript | 5.9.3 | 7.0.2 | TS 6+ has new syntax requirements |
| eslint | 9.39.4 | 10.7.0 | Config format changes |

---

## 5. Unused Dependencies (`depcheck`)

### 5.1 Unused Production Dependencies

| Package | Notes |
|---|---|
| `@supabase/ssr` | Not imported anywhere in source |
| `axios` | Not used directly (fetch or supabase used instead) |
| `shadcn` | CLI tool, should be devDependency |
| `tw-animate-css` | Not imported anywhere |

### 5.2 Unused Dev Dependencies

| Package | Notes |
|---|---|
| `@tailwindcss/postcss` | Tailwind v4 uses Vite plugin, not PostCSS |
| `@types/react-dom` | May be unused with React 19 |
| `@vitest/coverage-v8` | *Likely false positive* — configured in vitest.config.ts |
| `madge` | Dependency graph tool, only used ad-hoc |
| `tailwindcss` | *Likely false positive* — used via PostCSS/Vite config |

### 5.3 False Positives (from Python venv, not JS project)

```
react-docgen  → .venv/Lib/site-packages/dash/extract-meta.js
react-is      → .venv/Lib/site-packages/dash/deps/prop-types@15.8.1.js
object-assign → .venv/Lib/site-packages/dash/deps/prop-types@15.8.1.js
_process      → .venv/Lib/site-packages/dash/deps/prop-types@15.8.1.js
```

These are inside a Python virtual environment for the quant research folder and should be ignored.

---

## 6. Recommended Actions

### 🚨 Immediate (High Priority)

| # | Action | Reason |
|---|---|---|
| 1 | Check if `duckdb` has a newer version that upgrades `node-gyp` | Resolves glob, tar, rimraf, inflight, gauge, npmlog, are-we-there-yet |
| 2 | If duckdb cannot be updated, open an issue with duckdb maintainers | This is an upstream dependency chain issue |
| 3 | Remove unused deps: `@supabase/ssr`, `axios`, `tw-animate-css` | Clean up attack surface |
| 4 | Move `shadcn` to devDependencies | CLI tool, not a runtime dep |

### 📋 Standard Maintenance (Medium Priority)

| # | Action | Reason |
|---|---|---|
| 5 | Run `npm update` for safe semver updates | Fixes 11 out of 21 advisories |
| 6 | Remove `@tailwindcss/postcss` if using Vite plugin | Dead weight |
| 7 | Review `madge` — keep only if used in CI | devDependency cleanup |
| 8 | Consider removing `@types/react-dom` if React 19 changed the types | Declutter |

### ⚠️ Breaking Changes (Low Priority — Plan for EPIC)

| # | Action | Reason |
|---|---|---|
| 9 | Plan vitest 2→4 migration | Fixes critical vitest CVE + esbuild + vite issues |
| 10 | Plan TypeScript 5→7 migration | Long overdue, 2 major versions behind |
| 11 | Plan eslint 9→10 migration | Breaking config changes |

---

## 7. Proposal: EPIC 43 — Dependency Governance & Supply Chain Security

As previously proposed:

- **SBOM generation**: SPDX or CycloneDX format
- **Automated CVE scanning**: Daily via `npm audit` in CI
- **Dependency blocking**: Block high/critical severity transitive deps
- **License compliance**: Audit MIT, Apache-2.0, BSD, GPL usage
- **Auto-update bot**: Dependabot or Renovate
- **Lockfile integrity**: Verify checksums
- **Release signing**: Sign releases with GPG

This audit confirms that dependency governance is not theoretical — **3 critical and 10 high-severity vulnerabilities** exist today in the supply chain, with one (tar) having **no fix available**.