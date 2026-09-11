// AH YIELD ENGINE — Bet-observation builder.
//
// Joins canonical matches with market odds STRICTLY by canonical_match_id
// (never by team-name string matching), validates every row, resolves true
// provenance, collapses duplicate quotes of the same observation, and settles
// each side independently into a 1-unit bet observation with exact P&L.

import { createHash } from 'crypto';
import type {
  AhBetObservation,
  AhFavoriteStatus,
  AhProvenance,
  AhSide,
  BuildObservationsResult,
  CanonicalMatchRecord,
  MarketOddsRecord,
  RejectedAhRow,
} from './ahTypes';
import { createProvenanceResolver, snapshotFor, type AhProvenanceResolver } from './ahProvenance';
import { isValidHandicapLine, settleAhBet } from './ahSettlement';

export interface BuildObservationsOptions {
  resolver?: AhProvenanceResolver;
  /** Maximum plausible decimal odds; rows above are rejected as corrupt. */
  maxOdds?: number;
}

interface Candidate {
  row: MarketOddsRecord;
  match: CanonicalMatchRecord;
  provenance: AhProvenance;
  snapshot: ReturnType<typeof snapshotFor>;
  dedupKey: string;
  homeValid: boolean;
  awayValid: boolean;
}

function dataSourceLabel(sourceFile: string): string {
  const s = sourceFile.replace(/\\/g, '/').toLowerCase();
  if (s.includes('research/quant')) return 'football-data.co.uk:quant-bronze';
  if (s.includes('data/bronze/football_data')) return 'football-data.co.uk:main-bronze';
  return 'football-data.co.uk:unknown-root';
}

export function favoriteStatus(
  side: AhSide,
  selectionLine: number,
  homeOdds: number,
  awayOdds: number
): AhFavoriteStatus {
  if (selectionLine < 0) return 'favorite';
  if (selectionLine > 0) return 'underdog';
  // Level line: market favorite is the side priced lower (context from odds).
  if (side === 'home') {
    if (homeOdds < awayOdds) return 'favorite';
    if (homeOdds > awayOdds) return 'underdog';
    return 'market_neutral';
  }
  if (awayOdds < homeOdds) return 'favorite';
  if (awayOdds > homeOdds) return 'underdog';
  return 'market_neutral';
}

function makeObservation(params: {
  row: MarketOddsRecord;
  match: CanonicalMatchRecord;
  side: AhSide;
  selectionLine: number;
  odds: number;
  oppositeOdds: number | null;
  provenance: AhProvenance;
  snapshot: ReturnType<typeof snapshotFor>;
  homeOdds: number;
  awayOdds: number;
}): AhBetObservation {
  const { row, match, side, selectionLine, odds, oppositeOdds, provenance, snapshot, homeOdds, awayOdds } = params;
  const settled = settleAhBet({
    side,
    line: selectionLine,
    homeScore: match.homeGoals,
    awayScore: match.awayGoals,
    odds,
    stake: 1,
  });

  const observationId = createHash('sha256')
    .update([match.canonicalId, side, row.line, snapshot, provenance, row.bookmakerSource].join('|'))
    .digest('hex');

  return {
    observationId,
    oddsId: row.oddsId,
    canonicalMatchId: match.canonicalId,
    leagueId: match.leagueId,
    season: match.season,
    matchDate: match.matchDate,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.homeGoals,
    awayScore: match.awayGoals,
    side,
    marketLineHome: row.line as number,
    selectionLine,
    odds,
    oppositeOdds,
    snapshot,
    provenance,
    favoriteStatus: favoriteStatus(side, selectionLine, homeOdds, awayOdds),
    sourceFile: row.sourceFile,
    sourceRow: row.sourceRow,
    dataSource: dataSourceLabel(row.sourceFile),
    settlement: settled.outcome,
    settlementFraction: settled.settlementFraction,
    stake: 1,
    pnl: settled.pnl,
    returnAmount: settled.returnAmount,
  };
}

export function buildAhObservations(
  matches: CanonicalMatchRecord[],
  oddsRows: MarketOddsRecord[],
  options: BuildObservationsOptions = {}
): BuildObservationsResult {
  const resolver = options.resolver ?? createProvenanceResolver();
  const maxOdds = options.maxOdds ?? 1000;

  const matchById = new Map<string, CanonicalMatchRecord>();
  for (const m of matches) matchById.set(m.canonicalId, m);

  const rejected: RejectedAhRow[] = [];
  const candidates = new Map<string, Candidate>();
  let duplicates = 0;
  const duplicateKeys: string[] = [];
  let unmatchedOddsRows = 0;
  const provenanceCounts: Record<string, number> = {};
  const snapshotCounts: Record<string, number> = {};

  for (const row of oddsRows) {
    if (row.market !== 'AH') continue;
    const match = matchById.get(row.canonicalId);
    if (!match) {
      unmatchedOddsRows += 1;
      rejected.push({ oddsId: row.oddsId, canonicalId: row.canonicalId, reason: 'UNMATCHED_CANONICAL_ID' });
      continue;
    }
    if (!match.resultVerified) {
      rejected.push({ oddsId: row.oddsId, canonicalId: row.canonicalId, reason: 'RESULT_NOT_VERIFIED' });
      continue;
    }
    if (!isValidHandicapLine(row.line)) {
      rejected.push({ oddsId: row.oddsId, canonicalId: row.canonicalId, reason: `INVALID_LINE:${String(row.line)}` });
      continue;
    }
    if (!Number.isInteger(match.homeGoals) || !Number.isInteger(match.awayGoals) || match.homeGoals < 0 || match.awayGoals < 0) {
      rejected.push({ oddsId: row.oddsId, canonicalId: row.canonicalId, reason: 'INVALID_SCORE' });
      continue;
    }

    const provenance = resolver.resolve(row.sourceFile, row.observation, row.bookmakerSource);
    const snapshot = snapshotFor(provenance, row.observation);
    const line = row.line as number;
    const homeOdds = row.homeOdds;
    const awayOdds = row.awayOdds;

    const homeValid =
      typeof homeOdds === 'number' && Number.isFinite(homeOdds) && homeOdds > 1 && homeOdds < maxOdds;
    const awayValid =
      typeof awayOdds === 'number' && Number.isFinite(awayOdds) && awayOdds > 1 && awayOdds < maxOdds;

    if (!homeValid) rejected.push({ oddsId: row.oddsId, canonicalId: row.canonicalId, reason: `INVALID_HOME_ODDS:${String(homeOdds)}` });
    if (!awayValid) rejected.push({ oddsId: row.oddsId, canonicalId: row.canonicalId, reason: `INVALID_AWAY_ODDS:${String(awayOdds)}` });
    if (!homeValid && !awayValid) continue;

    const dedupKey = `${row.canonicalId}|${line}|${snapshot}|${provenance}`;
    const existing = candidates.get(dedupKey);
    if (existing) {
      duplicates += 1;
      if (duplicateKeys.length < 50) duplicateKeys.push(dedupKey);
      const newValidSides = (homeValid ? 1 : 0) + (awayValid ? 1 : 0);
      const oldValidSides = (existing.homeValid ? 1 : 0) + (existing.awayValid ? 1 : 0);
      // Deterministic winner: most complete quote first, then smallest odds_id.
      if (newValidSides < oldValidSides) continue;
      if (newValidSides === oldValidSides && row.oddsId.localeCompare(existing.row.oddsId) >= 0) continue;
    }

    candidates.set(dedupKey, {
      row,
      match,
      provenance,
      snapshot,
      dedupKey,
      homeValid,
      awayValid,
    });
  }

  const observations: AhBetObservation[] = [];
  for (const c of candidates.values()) {
    provenanceCounts[c.provenance] = (provenanceCounts[c.provenance] ?? 0) + 1;
    snapshotCounts[c.snapshot] = (snapshotCounts[c.snapshot] ?? 0) + 1;
    const line = c.row.line as number;
    if (c.homeValid) {
      observations.push(
        makeObservation({
          row: c.row,
          match: c.match,
          side: 'home',
          selectionLine: line,
          odds: c.row.homeOdds as number,
          oppositeOdds: c.awayValid ? (c.row.awayOdds as number) : null,
          provenance: c.provenance,
          snapshot: c.snapshot,
          homeOdds: c.row.homeOdds as number,
          awayOdds: (c.row.awayOdds as number) ?? 0,
        })
      );
    }
    if (c.awayValid) {
      observations.push(
        makeObservation({
          row: c.row,
          match: c.match,
          side: 'away',
          selectionLine: -line,
          odds: c.row.awayOdds as number,
          oppositeOdds: c.homeValid ? (c.row.homeOdds as number) : null,
          provenance: c.provenance,
          snapshot: c.snapshot,
          homeOdds: (c.row.homeOdds as number) ?? 0,
          awayOdds: c.row.awayOdds as number,
        })
      );
    }
  }

  observations.sort(
    (a, b) =>
      a.matchDate.localeCompare(b.matchDate) ||
      a.canonicalMatchId.localeCompare(b.canonicalMatchId) ||
      a.marketLineHome - b.marketLineHome ||
      a.side.localeCompare(b.side) ||
      a.snapshot.localeCompare(b.snapshot) ||
      a.provenance.localeCompare(b.provenance)
  );

  return {
    observations,
    rejected,
    duplicates,
    duplicateKeys,
    unmatchedOddsRows,
    provenanceCounts,
    snapshotCounts,
  };
}

/**
 * Derived "best available" cohort: for each match × line × snapshot × side
 * with BOTH genuine books present (Pinnacle and Bet365), take the highest
 * offered price. Methodology is reported separately and never blended with
 * single-bookmaker cohorts. Requires >= 2 distinct genuine books; groups with
 * one book are not emitted.
 */
export function buildBestAvailableObservations(observations: AhBetObservation[]): AhBetObservation[] {
  const eligible = observations.filter((o) => o.provenance === 'pinnacle' || o.provenance === 'bet365');

  const groups = new Map<string, AhBetObservation[]>();
  for (const o of eligible) {
    const key = `${o.canonicalMatchId}|${o.marketLineHome}|${o.snapshot}|${o.side}`;
    const list = groups.get(key);
    if (list) list.push(o);
    else groups.set(key, [o]);
  }

  const bestByKey = new Map<string, AhBetObservation>();
  for (const [key, list] of groups) {
    const books = new Set(list.map((o) => o.provenance));
    if (books.size < 2) continue;
    let best = list[0];
    for (const o of list) if (o.odds > best.odds) best = o;
    bestByKey.set(key, best);
  }

  const out: AhBetObservation[] = [];
  for (const best of bestByKey.values()) {
    const oppositeKey = `${best.canonicalMatchId}|${best.marketLineHome}|${best.snapshot}|${
      best.side === 'home' ? 'away' : 'home'
    }`;
    const opposite = bestByKey.get(oppositeKey);
    const oppositeOdds = opposite ? opposite.odds : null;

    const settled = settleAhBet({
      side: best.side,
      line: best.selectionLine,
      homeScore: best.homeScore,
      awayScore: best.awayScore,
      odds: best.odds,
      stake: best.stake,
    });

    const homeOdds = best.side === 'home' ? best.odds : oppositeOdds ?? 0;
    const awayOdds = best.side === 'away' ? best.odds : oppositeOdds ?? 0;

    out.push({
      ...best,
      observationId: `${best.observationId}-best`,
      provenance: 'best_available',
      odds: best.odds,
      oppositeOdds,
      settlement: settled.outcome,
      settlementFraction: settled.settlementFraction,
      pnl: settled.pnl,
      returnAmount: settled.returnAmount,
      favoriteStatus: favoriteStatus(best.side, best.selectionLine, homeOdds, awayOdds),
    });
  }

  out.sort(
    (a, b) =>
      a.matchDate.localeCompare(b.matchDate) ||
      a.canonicalMatchId.localeCompare(b.canonicalMatchId) ||
      a.marketLineHome - b.marketLineHome ||
      a.side.localeCompare(b.side) ||
      a.snapshot.localeCompare(b.snapshot)
  );
  return out;
}
