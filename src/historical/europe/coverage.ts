// Coverage + readiness computation. Every number derives from the actual
// canonical records — nothing is hardcoded. Readiness thresholds are explicit
// and deterministic: >=95% READY, 25-95% PARTIAL, <25% INSUFFICIENT.
// Location: src/historical/europe/coverage.ts

import type {
  CanonicalMatch,
  ClusterCoverage,
  ClusterId,
  LeagueCoverage,
  LeagueMeta,
  MarketAvailability,
  ReadinessLevel,
} from './types';

export const READY_THRESHOLD_PCT = 95;
export const PARTIAL_THRESHOLD_PCT = 25;

export function readinessFor(pct: number): ReadinessLevel {
  if (pct >= READY_THRESHOLD_PCT) return 'READY';
  if (pct >= PARTIAL_THRESHOLD_PCT) return 'PARTIAL';
  return 'INSUFFICIENT';
}

function hasUsableMl(m: CanonicalMatch): boolean {
  return m.odds !== null && m.odds.h1 != null && m.odds.d1 != null && m.odds.a1 != null;
}
function hasUsableAh(m: CanonicalMatch): boolean {
  return m.odds !== null && m.odds.ahLine != null && m.odds.ahHome != null && m.odds.ahAway != null;
}
function hasUsableOu(m: CanonicalMatch): boolean {
  return m.odds !== null && (m.odds.over != null || m.odds.cover != null) && (m.odds.under != null || m.odds.cunder != null);
}

export function leagueCoverage(meta: LeagueMeta, matches: CanonicalMatch[]): LeagueCoverage {
  const valid = matches.length;
  const usable: MarketAvailability = { ml: 0, ah: 0, ou: 0, btts: 0 };
  for (const m of matches) {
    if (hasUsableMl(m)) usable.ml += 1;
    if (hasUsableAh(m)) usable.ah += 1;
    if (hasUsableOu(m)) usable.ou += 1;
    if (m.btts === true || m.btts === false) usable.btts += 1; // always derived
  }
  const pct = (n: number) => (valid > 0 ? Number(((n / valid) * 100).toFixed(2)) : 0);
  return {
    ...meta,
    coverage: usable,
    mlPct: pct(usable.ml),
    ahPct: pct(usable.ah),
    ouPct: pct(usable.ou),
    bttsPct: pct(usable.btts),
    readiness: {
      ml: readinessFor(pct(usable.ml)),
      ah: readinessFor(pct(usable.ah)),
      ou: readinessFor(pct(usable.ou)),
      btts: valid > 0 ? 'READY' : 'INSUFFICIENT',
    },
  };
}

export function clusterCoverage(cluster: ClusterId, leagueCovs: LeagueCoverage[]): ClusterCoverage {
  const leagues = leagueCovs.filter((l) => l.cluster === cluster);
  const matches = leagues.reduce((s, l) => s + l.valid, 0);
  const seasons = new Set<string>();
  for (const l of leagues) for (const s of l.seasons) seasons.add(s);
  return {
    cluster,
    leaguesIncluded: leagues.filter((l) => l.status === 'INCLUDED' || l.valid > 0).length,
    seasons: seasons.size,
    matches,
    valid: matches,
    ml: leagues.reduce((s, l) => s + l.coverage.ml, 0),
    ah: leagues.reduce((s, l) => s + l.coverage.ah, 0),
    ou: leagues.reduce((s, l) => s + l.coverage.ou, 0),
    btts: leagues.reduce((s, l) => s + l.coverage.btts, 0),
  };
}
