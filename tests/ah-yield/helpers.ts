// Test helpers for the AH yield engine suite.

import { settleAhBet } from '../../src/lib/research/ah-yield/ahSettlement';
import type {
  AhBetObservation,
  AhFavoriteStatus,
  AhProvenance,
  AhSide,
  AhSnapshot,
} from '../../src/lib/research/ah-yield/ahTypes';

export interface ObsInput {
  canonicalMatchId?: string;
  leagueId?: string;
  season?: string;
  matchDate?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  side?: AhSide;
  marketLineHome?: number;
  odds?: number;
  oppositeOdds?: number | null;
  snapshot?: AhSnapshot;
  provenance?: AhProvenance;
  favoriteStatus?: AhFavoriteStatus;
}

let counter = 0;

export function makeObs(input: ObsInput = {}): AhBetObservation {
  const side = input.side ?? 'home';
  const marketLineHome = input.marketLineHome ?? -0.5;
  const selectionLine = side === 'home' ? marketLineHome : -marketLineHome;
  const homeScore = input.homeScore ?? 1;
  const awayScore = input.awayScore ?? 0;
  const odds = input.odds ?? 1.9;
  const settled = settleAhBet({ side, line: selectionLine, homeScore, awayScore, odds, stake: 1 });
  counter += 1;
  return {
    observationId: `test-${counter}`,
    oddsId: `odds-${counter}`,
    canonicalMatchId: input.canonicalMatchId ?? `MATCH-${counter}`,
    leagueId: input.leagueId ?? 'ENG-PL',
    season: input.season ?? '2024-2025',
    matchDate: input.matchDate ?? '2024-08-01',
    homeTeam: input.homeTeam ?? 'Home FC',
    awayTeam: input.awayTeam ?? 'Away FC',
    homeScore,
    awayScore,
    side,
    marketLineHome,
    selectionLine,
    odds,
    oppositeOdds: input.oppositeOdds ?? null,
    snapshot: input.snapshot ?? 'closing',
    provenance: input.provenance ?? 'pinnacle',
    favoriteStatus: input.favoriteStatus ?? (selectionLine < 0 ? 'favorite' : selectionLine > 0 ? 'underdog' : 'market_neutral'),
    sourceFile: 'test.csv',
    sourceRow: counter,
    dataSource: 'test',
    settlement: settled.outcome,
    settlementFraction: settled.settlementFraction,
    stake: 1,
    pnl: settled.pnl,
    returnAmount: settled.returnAmount,
  };
}
