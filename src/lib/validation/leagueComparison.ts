/**
 * HandicapLab League Comparison
 * ===================================
 * Compare and rank validation metrics across different leagues.
 *
 * All functions are pure --- no side effects.
 * No production code is modified.
 */

import { ValidationInput, ValidationMetrics, computeMetrics } from './metrics';

export interface LeagueRanking {
  league: string;
  metrics: ValidationMetrics;
  rank: number;
}

export class LeagueComparison {
  static compareByLeague(r: Record<string, ValidationInput>): Record<string, ValidationMetrics> {
    const result: Record<string, ValidationMetrics> = {};
    for (const [league, input] of Object.entries(r)) {
      result[league] = computeMetrics(input);
    }
    return result;
  }

  static rankLeagues(r: Record<string, ValidationInput>): LeagueRanking[] {
    return Object.entries(LeagueComparison.compareByLeague(r))
      .map(([league, metrics]) => ({ league, metrics, rank: 0 }))
      .sort((a, b) => b.metrics.roi - a.metrics.roi)
      .map((item, i) => ({ ...item, rank: i + 1 }));
  }

  static findBestLeague(r: Record<string, ValidationInput>, mk: keyof ValidationMetrics): string | null {
    const leagues = Object.keys(r);
    if (leagues.length === 0) return null;
    let best: string | null = null;
    let bestVal = -Infinity;
    for (const league of leagues) {
      const val = computeMetrics(r[league])[mk] as number;
      if (val > bestVal) { bestVal = val; best = league; }
    }
    return best;
  }
}

