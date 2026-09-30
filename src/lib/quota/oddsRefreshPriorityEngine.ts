// ============================================================================
// ODDS REFRESH PRIORITY ENGINE — QUOTA-AWARE FIXTURE RANKING
// ============================================================================
// Location: src/lib/quota/oddsRefreshPriorityEngine.ts
//
// Invariants enforced (Section 4, 6, 23):
// 1. Never blindly refresh every fixture. Rank fixtures before spending OddsPAPI quota.
// 2. Score based on kickoff proximity, league reliability, odds age, market unlock potential,
//    and feature strength.
// 3. Priority Tiers:
//    - TIER_A: High probability of multiple positive-EV predictions (Score >= 75) -> Spend first
//    - TIER_B: Moderate probability (Score 50-74) -> Spend second
//    - TIER_C: Low probability (Score 30-49) -> Spend only if budget remains
//    - TIER_D: Do not spend quota (Score < 30) -> NEVER spend
// 4. Adaptive freshness: Priority increases as kickoff approaches (<6h highest, <2h critical).
//    Already fresh odds (<4h) avoid wasteful refresh.
// ============================================================================

import { QuotaBudgetController, QuotaBudgetSnapshot } from './quotaBudgetController';

export type PriorityTier = 'TIER_A' | 'TIER_B' | 'TIER_C' | 'TIER_D';

export interface FixturePriorityCandidate {
  canonicalMatchId: string;
  fixture: string;
  competition: string;
  kickoffUtc: string; // ISO 8601 UTC
  currentOddsTimestampUtc?: string | null;
  supportedMarkets?: ('AH' | 'OU' | 'BTTS')[];
  footystatsFeatures?: {
    preMatchPpgHome?: number;
    preMatchPpgAway?: number;
    xgHome?: number;
    xgAway?: number;
    bttsPotential?: number;
    over25Potential?: number;
  };
  projectedSignalStrength?: number; // 0..1
}

export interface OddsRefreshPriorityScoreResult {
  canonicalMatchId: string;
  fixture: string;
  competition: string;
  kickoffUtc: string;
  score: number; // 0..100
  tier: PriorityTier;
  proximityHours: number;
  oddsAgeHours: number | null;
  isEconomicallyJustified: boolean;
  scoreBreakdown: {
    proximityPoints: number; // 0..35
    leaguePoints: number; // 0..25
    freshnessGapPoints: number; // 0..20
    marketDensityPoints: number; // 0..15
    featureBonusPoints: number; // 0..5
  };
  rejectionReason?: string;
}

export interface BatchRankingResult {
  rankedFixtures: OddsRefreshPriorityScoreResult[];
  tierDistribution: Record<PriorityTier, number>;
  recommendedRefreshCount: number;
  selectedFixturesToRefresh: OddsRefreshPriorityScoreResult[];
  budgetSnapshot: QuotaBudgetSnapshot;
  summary: string;
}

const TOP_LEAGUES_TIER_1 = [
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
];

const WHITELIST_LEAGUES_TIER_2 = [
  'Championship',
  'Eredivisie',
];

const WHITELIST_LEAGUES_TIER_3 = [
  'J1 League',
  'K League',
  'Liga 1',
  'Liga 1 Indonesia',
];

export class OddsRefreshPriorityEngine {
  /**
   * Computes priority score (0-100) and tier for a single fixture candidate.
   */
  public static evaluateFixturePriority(
    candidate: FixturePriorityCandidate,
    nowMs: number = Date.now()
  ): OddsRefreshPriorityScoreResult {
    const kickoffMs = new Date(candidate.kickoffUtc).getTime();
    const diffHours = (kickoffMs - nowMs) / 3600000;

    // Reject fixtures already kicked off
    if (diffHours <= 0) {
      return {
        canonicalMatchId: candidate.canonicalMatchId,
        fixture: candidate.fixture,
        competition: candidate.competition,
        kickoffUtc: candidate.kickoffUtc,
        score: 0,
        tier: 'TIER_D',
        proximityHours: diffHours,
        oddsAgeHours: null,
        isEconomicallyJustified: false,
        scoreBreakdown: {
          proximityPoints: 0,
          leaguePoints: 0,
          freshnessGapPoints: 0,
          marketDensityPoints: 0,
          featureBonusPoints: 0,
        },
        rejectionReason: 'PAST_KICKOFF: Fixture already started or finished.',
      };
    }

    // 1. Kickoff Proximity (0..35 points)
    // <2h = 35, <6h = 32, 6-24h = 25, 24-72h = 15, >72h = 5
    let proximityPoints = 5;
    if (diffHours < 2.0) {
      proximityPoints = 35;
    } else if (diffHours < 6.0) {
      proximityPoints = 32;
    } else if (diffHours <= 24.0) {
      proximityPoints = 25;
    } else if (diffHours <= 72.0) {
      proximityPoints = 15;
    }

    // 2. League Reliability & Whitelist (0..25 points)
    let leaguePoints = 0;
    const compNorm = (candidate.competition || '').trim();
    if (TOP_LEAGUES_TIER_1.some(l => compNorm.toLowerCase().includes(l.toLowerCase()))) {
      leaguePoints = 25;
    } else if (WHITELIST_LEAGUES_TIER_2.some(l => compNorm.toLowerCase().includes(l.toLowerCase()))) {
      leaguePoints = 20;
    } else if (WHITELIST_LEAGUES_TIER_3.some(l => compNorm.toLowerCase().includes(l.toLowerCase()))) {
      leaguePoints = 16;
    } else {
      // Non-whitelisted league gets 0 league points
      leaguePoints = 0;
    }

    // 3. Odds Freshness Gap (0..20 points)
    let oddsAgeHours: number | null = null;
    let freshnessGapPoints = 20; // Default to max if no odds exist yet
    if (candidate.currentOddsTimestampUtc) {
      const oddsMs = new Date(candidate.currentOddsTimestampUtc).getTime();
      if (!isNaN(oddsMs)) {
        oddsAgeHours = Math.max(0, (nowMs - oddsMs) / 3600000);
        if (oddsAgeHours > 24) {
          freshnessGapPoints = 20; // Stale odds
        } else if (oddsAgeHours >= 12) {
          freshnessGapPoints = 15;
        } else if (oddsAgeHours >= 4) {
          freshnessGapPoints = 8;
        } else {
          freshnessGapPoints = 0; // Already very fresh (< 4h), waste to refresh unless < 2h to kickoff
          if (diffHours < 2.0) {
            freshnessGapPoints = 5; // In critical pre-match window, allow small refresh boost
          }
        }
      }
    }

    // 4. Market Density / Unlock Potential (0..15 points)
    const markets = candidate.supportedMarkets || ['AH', 'OU', 'BTTS'];
    let marketDensityPoints = 5;
    if (markets.length >= 3) {
      marketDensityPoints = 15;
    } else if (markets.length === 2) {
      marketDensityPoints = 10;
    }

    // 5. Pre-Match Feature Bonus (0..5 points)
    let featureBonusPoints = 0;
    if (candidate.footystatsFeatures) {
      const { xgHome, xgAway, bttsPotential } = candidate.footystatsFeatures;
      if (xgHome !== undefined && xgAway !== undefined && Math.abs(xgHome - xgAway) > 0.5) {
        featureBonusPoints += 2;
      }
      if (bttsPotential && bttsPotential > 60) {
        featureBonusPoints += 2;
      }
      if (candidate.projectedSignalStrength && candidate.projectedSignalStrength > 0.6) {
        featureBonusPoints += 1;
      }
      featureBonusPoints = Math.min(5, featureBonusPoints);
    } else if (candidate.projectedSignalStrength && candidate.projectedSignalStrength > 0.5) {
      featureBonusPoints = 3;
    }

    const totalScore = Math.min(
      100,
      proximityPoints + leaguePoints + freshnessGapPoints + marketDensityPoints + featureBonusPoints
    );

    // Determine Tier
    let tier: PriorityTier = 'TIER_D';
    if (totalScore >= 75 && leaguePoints > 0) {
      tier = 'TIER_A';
    } else if (totalScore >= 50 && leaguePoints > 0) {
      tier = 'TIER_B';
    } else if (totalScore >= 30 && leaguePoints > 0) {
      tier = 'TIER_C';
    } else {
      tier = 'TIER_D';
    }

    // Check if economically justified
    // Stale or missing odds on whitelisted matches with kickoff > 0 are justified.
    // If odds are already super fresh (<4h) and match is > 2h away, it's not economically justified.
    let isEconomicallyJustified = tier !== 'TIER_D';
    let rejectionReason: string | undefined;

    if (leaguePoints === 0) {
      isEconomicallyJustified = false;
      rejectionReason = 'NON_WHITELISTED_LEAGUE: League outside production whitelist.';
    } else if (oddsAgeHours !== null && oddsAgeHours < 4 && diffHours >= 2.0) {
      isEconomicallyJustified = false;
      rejectionReason = `ODDS_ALREADY_FRESH: Current odds are ${oddsAgeHours.toFixed(1)}h old; refresh unnecessary until closer to kickoff.`;
    }

    return {
      canonicalMatchId: candidate.canonicalMatchId,
      fixture: candidate.fixture,
      competition: candidate.competition,
      kickoffUtc: candidate.kickoffUtc,
      score: totalScore,
      tier,
      proximityHours: diffHours,
      oddsAgeHours,
      isEconomicallyJustified,
      scoreBreakdown: {
        proximityPoints,
        leaguePoints,
        freshnessGapPoints,
        marketDensityPoints,
        featureBonusPoints,
      },
      rejectionReason,
    };
  }

  /**
   * Evaluates and ranks a batch of upcoming fixtures, selecting only up to safe request budget.
   */
  public static rankFixtures(
    candidates: FixturePriorityCandidate[],
    options: {
      nowMs?: number;
      overrideBudget?: number;
    } = {}
  ): BatchRankingResult {
    const nowMs = options.nowMs ?? Date.now();
    const evaluated = candidates.map(c => this.evaluateFixturePriority(c, nowMs));

    // Sort descending by score, then ascending by proximity (closer kickoff first)
    evaluated.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.proximityHours - b.proximityHours;
    });

    const tierDistribution: Record<PriorityTier, number> = {
      TIER_A: 0,
      TIER_B: 0,
      TIER_C: 0,
      TIER_D: 0,
    };

    for (const e of evaluated) {
      tierDistribution[e.tier]++;
    }

    const demandCalculation = QuotaBudgetController.computeSafeDailyBudget({
      upcomingFixturesCount: candidates.length,
      highQualityTierACount: tierDistribution.TIER_A,
      staleOddsFixturesCount: evaluated.filter(e => e.oddsAgeHours === null || e.oddsAgeHours > 24).length,
      nowMs,
    });

    const availableBudget = options.overrideBudget ?? demandCalculation.safeDailyRequestBudget;

    // Allocation priority:
    // A -> first, B -> second, C -> only if budget remains, D -> never
    const selected: OddsRefreshPriorityScoreResult[] = [];
    const pool = evaluated.filter(e => e.isEconomicallyJustified);

    const tierA = pool.filter(e => e.tier === 'TIER_A');
    const tierB = pool.filter(e => e.tier === 'TIER_B');
    const tierC = pool.filter(e => e.tier === 'TIER_C');

    for (const item of tierA) {
      if (selected.length < availableBudget) selected.push(item);
    }
    for (const item of tierB) {
      if (selected.length < availableBudget) selected.push(item);
    }
    for (const item of tierC) {
      if (selected.length < availableBudget) selected.push(item);
    }

    const summary = `Evaluated ${candidates.length} candidates. Tiers: [A: ${tierDistribution.TIER_A}, B: ${tierDistribution.TIER_B}, C: ${tierDistribution.TIER_C}, D: ${tierDistribution.TIER_D}]. Selected ${selected.length} within budget of ${availableBudget}.`;

    return {
      rankedFixtures: evaluated,
      tierDistribution,
      recommendedRefreshCount: selected.length,
      selectedFixturesToRefresh: selected,
      budgetSnapshot: demandCalculation.snapshot,
      summary,
    };
  }
}
