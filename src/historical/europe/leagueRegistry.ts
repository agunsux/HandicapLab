// Deterministic 3-cluster European league registry (EPIC: Historical European
// League Data Expansion & 3-Cluster Dataset).
// Location: src/historical/europe/leagueRegistry.ts

import type { ClusterId, LeagueEntry } from './types';

/**
 * Canonical registry of the EPIC's target leagues. `status` is authoritative:
 * a league is INCLUDED only when a verified historical source exists in the
 * repository (see sourceDiscovery). Leagues without a real source are EXCLUDED
 * with an exact reason — never fabricate data to change that.
 */
export const EUROPEAN_LEAGUE_REGISTRY: LeagueEntry[] = [
  // ─── CLUSTER A — TIER-1 / TOP 5 ───────────────────────────────────────
  { cluster: 'A', leagueId: 'ENG-PL', name: 'Premier League', country: 'England', footballDataCode: 'E0', status: 'INCLUDED' },
  { cluster: 'A', leagueId: 'ESP-LALIGA', name: 'La Liga', country: 'Spain', footballDataCode: 'SP1', status: 'INCLUDED' },
  { cluster: 'A', leagueId: 'DEU-BUNDESLIGA', name: 'Bundesliga', country: 'Germany', footballDataCode: 'D1', status: 'INCLUDED' },
  { cluster: 'A', leagueId: 'ITA-SERIEA', name: 'Serie A', country: 'Italy', footballDataCode: 'I1', status: 'INCLUDED' },
  { cluster: 'A', leagueId: 'FRA-LIGUE1', name: 'Ligue 1', country: 'France', footballDataCode: 'F1', status: 'INCLUDED' },

  // ─── CLUSTER B — STRONG SECOND-TIER ───────────────────────────────────
  { cluster: 'B', leagueId: 'NED-ERE', name: 'Eredivisie', country: 'Netherlands', footballDataCode: 'N1', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no football-data.co.uk source file present in repository' },
  { cluster: 'B', leagueId: 'POR-PRIMEIRA', name: 'Primeira Liga', country: 'Portugal', footballDataCode: 'P1', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no football-data.co.uk source file present in repository' },
  { cluster: 'B', leagueId: 'BEL-PRO', name: 'Belgian Pro League', country: 'Belgium', footballDataCode: 'B1', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no football-data.co.uk source file present in repository' },
  { cluster: 'B', leagueId: 'SCO-PREM', name: 'Scottish Premiership', country: 'Scotland', footballDataCode: 'SC0', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no football-data.co.uk source file present in repository' },
  { cluster: 'B', leagueId: 'TUR-SL', name: 'Süper Lig', country: 'Turkey', footballDataCode: 'T1', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no football-data.co.uk source file present in repository' },
  { cluster: 'B', leagueId: 'AUT-BUND', name: 'Austrian Bundesliga', country: 'Austria', footballDataCode: 'A1', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no football-data.co.uk source file present in repository' },
  { cluster: 'B', leagueId: 'SUI-SL', name: 'Swiss Super League', country: 'Switzerland', footballDataCode: 'SL1', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no football-data.co.uk source file present in repository' },

  // ─── CLUSTER C — OTHER MODELABLE EUROPEAN ─────────────────────────────
  // All candidates lack any verified historical source inside the repository;
  // they are listed so the coverage audit can prove they were considered.
  { cluster: 'C', leagueId: 'DNK-SL', name: 'Danish Superliga', country: 'Denmark', footballDataCode: 'UNKNOWN', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no verified football-data.co.uk source file present in repository' },
  { cluster: 'C', leagueId: 'NOR-EL', name: 'Eliteserien', country: 'Norway', footballDataCode: 'UNKNOWN', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no verified football-data.co.uk source file present in repository' },
  { cluster: 'C', leagueId: 'SWE-AL', name: 'Allsvenskan', country: 'Sweden', footballDataCode: 'UNKNOWN', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no verified football-data.co.uk source file present in repository' },
  { cluster: 'C', leagueId: 'POL-EKS', name: 'Ekstraklasa', country: 'Poland', footballDataCode: 'UNKNOWN', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no verified football-data.co.uk source file present in repository' },
  { cluster: 'C', leagueId: 'CZE-1L', name: 'Czech First League', country: 'Czech Republic', footballDataCode: 'UNKNOWN', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no verified football-data.co.uk source file present in repository' },
  { cluster: 'C', leagueId: 'GRC-SL', name: 'Greek Super League', country: 'Greece', footballDataCode: 'UNKNOWN', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no verified football-data.co.uk source file present in repository' },
  { cluster: 'C', leagueId: 'ROU-L1', name: 'Liga I', country: 'Romania', footballDataCode: 'UNKNOWN', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no verified football-data.co.uk source file present in repository' },
  { cluster: 'C', leagueId: 'HRV-HNL', name: 'HNL', country: 'Croatia', footballDataCode: 'UNKNOWN', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no verified football-data.co.uk source file present in repository' },
  { cluster: 'C', leagueId: 'SRB-SL', name: 'SuperLiga', country: 'Serbia', footballDataCode: 'UNKNOWN', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no verified football-data.co.uk source file present in repository' },
  { cluster: 'C', leagueId: 'HUN-NB1', name: 'NB I', country: 'Hungary', footballDataCode: 'UNKNOWN', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no verified football-data.co.uk source file present in repository' },
  { cluster: 'C', leagueId: 'FIN-VL', name: 'Veikkausliiga', country: 'Finland', footballDataCode: 'UNKNOWN', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no verified football-data.co.uk source file present in repository' },
  { cluster: 'C', leagueId: 'IRL-PD', name: 'Premier Division', country: 'Ireland', footballDataCode: 'UNKNOWN', status: 'EXCLUDED', excludeReason: 'SOURCE_DATA_ABSENT: no verified football-data.co.uk source file present in repository' },
];

const BY_ID = new Map(EUROPEAN_LEAGUE_REGISTRY.map((l) => [l.leagueId, l]));
const BY_CODE = new Map<string, LeagueEntry>();
for (const league of EUROPEAN_LEAGUE_REGISTRY) {
  if (league.footballDataCode !== 'UNKNOWN') BY_CODE.set(league.footballDataCode, league);
}

export function getLeagueById(leagueId: string): LeagueEntry | undefined {
  return BY_ID.get(leagueId);
}

/** Map a football-data.co.uk division code (E0, SP1, D1, I1, F1, …) to a league. */
export function getLeagueByFootballDataCode(code: string): LeagueEntry | undefined {
  return BY_CODE.get(code);
}

export function classifyCluster(leagueId: string): ClusterId | null {
  return BY_ID.get(leagueId)?.cluster ?? null;
}

/** Deterministic sort: cluster A → B → C, then by leagueId. */
export function sortedLeagues(): LeagueEntry[] {
  const order: Record<ClusterId, number> = { A: 0, B: 1, C: 2 };
  return [...EUROPEAN_LEAGUE_REGISTRY].sort(
    (a, b) => order[a.cluster] - order[b.cluster] || a.leagueId.localeCompare(b.leagueId)
  );
}
