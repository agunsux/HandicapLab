// HandicapLab Intelligence Engine
// Location: src/lib/engines/intelligence-engine.ts

import { RecommendationOutput } from './recommendation-engine';

export interface IntelligenceDashboardReport {
  todaysBestEdge: RecommendationOutput[];
  topValueBets: RecommendationOutput[];
  highestConfidence: RecommendationOutput[];
  highestRoiLeagues: { league: string; projectedROI: number }[];
  bestAsianHandicaps: RecommendationOutput[];
  bestOvers: RecommendationOutput[];
  bestUnders: RecommendationOutput[];
  bestClvProjections: { match_id: string; market: string; clv: number }[];
}

export class IntelligenceEngine {
  /**
   * Aggregates multiple recommendation outputs across leagues/matches to generate global insights.
   * Stateless and completely deterministic.
   */
  public static generateInsights(
    recommendations: RecommendationOutput[],
    leagueMap: Record<string, string> = {} // maps matchId/league to league name
  ): IntelligenceDashboardReport {
    // 1. Sort by expected value / edge
    const valueSorted = [...recommendations].sort((a, b) => b.expected_value - a.expected_value);

    // 2. Todays Best Edge: positive EV, sorted descending, limit 5
    const todaysBestEdge = valueSorted.filter(r => r.expected_value > 0).slice(0, 5);

    // 3. Top Value Bets: decision is VALUE or STRONG_VALUE, limit 10
    const topValueBets = valueSorted
      .filter(r => r.decision === 'VALUE' || r.decision === 'STRONG_VALUE')
      .slice(0, 10);

    // 4. Highest Confidence: sorted by confidence score desc, limit 5
    const highestConfidence = [...recommendations]
      .sort((a, b) => b.confidence_score - a.confidence_score)
      .slice(0, 5);

    // 5. Best Asian Handicap: AH market types, sorted desc
    const bestAsianHandicaps = valueSorted
      .filter(r => r.market.toLowerCase().includes('ah '))
      .slice(0, 5);

    // 6. Best Overs: Over market types
    const bestOvers = valueSorted
      .filter(r => r.market.toLowerCase().startsWith('over '))
      .slice(0, 5);

    // 7. Best Unders: Under market types
    const bestUnders = valueSorted
      .filter(r => r.market.toLowerCase().startsWith('under '))
      .slice(0, 5);

    // 8. League ROI Projection (aggregate EV of value matches)
    const leagueEVs: Record<string, { sum: number; count: number }> = {};
    recommendations.forEach(r => {
      if (r.expected_value > 0) {
        const league = leagueMap[r.match_id] || 'EPL';
        if (!leagueEVs[league]) {
          leagueEVs[league] = { sum: 0, count: 0 };
        }
        leagueEVs[league].sum += r.expected_value;
        leagueEVs[league].count += 1;
      }
    });

    const highestRoiLeagues = Object.entries(leagueEVs)
      .map(([league, data]) => ({
        league,
        projectedROI: Number((data.sum / data.count).toFixed(2))
      }))
      .sort((a, b) => b.projectedROI - a.projectedROI)
      .slice(0, 5);

    // 9. Best CLV Projections
    // Simulate CLV based on the difference between fair odds and market odds
    const bestClvProjections = recommendations
      .map(r => ({
        match_id: r.match_id,
        market: r.market,
        clv: Number((Math.max(0.01, r.market_odds - r.fair_odds) * 10).toFixed(2))
      }))
      .sort((a, b) => b.clv - a.clv)
      .slice(0, 5);

    return {
      todaysBestEdge,
      topValueBets,
      highestConfidence,
      highestRoiLeagues,
      bestAsianHandicaps,
      bestOvers,
      bestUnders,
      bestClvProjections
    };
  }
}
