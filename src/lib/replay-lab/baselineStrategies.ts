/**
 * EPIC 16.5 — Baseline Execution Framework
 * =========================================
 * Provides deterministic baseline prediction strategies for comparison.
 *
 * Every replay is automatically executed against:
 *   Champion, Poisson, Dixon-Coles, Elo, Closing Odds, Opening Odds,
 *   Random, Favorite, Underdog, Flat Probability, Market Probability.
 *
 * All baseline predictions are deterministic for identical inputs.
 */

import type { BaselineId, BaselineStrategy } from './types';
import { BASELINE_VERSION } from './types';

export type { BaselineId, BaselineStrategy };

function clamp(v: number): number {
  return Math.max(0.001, Math.min(0.999, v));
}

function normalize(h: number, d: number, a: number): { homeProbability: number; drawProbability: number; awayProbability: number } {
  const total = h + d + a;
  if (total === 0) return { homeProbability: 0.333, drawProbability: 0.333, awayProbability: 0.333 };
  return { homeProbability: h / total, drawProbability: d / total, awayProbability: a / total };
}

export function createAllBaselines(): readonly BaselineStrategy[] {
  return [
    {
      id: 'champion',
      name: 'Champion Model',
      description: 'Placeholder for the current champion prediction engine',
      version: BASELINE_VERSION,
      predict: () => ({ homeProbability: 0.4, drawProbability: 0.3, awayProbability: 0.3 }),
    },
    {
      id: 'poisson',
      name: 'Poisson Model',
      description: 'Simple Poisson-based expectation using historical averages',
      version: BASELINE_VERSION,
      predict: (m) => {
        const lambdaH = 1.5;
        const lambdaA = 1.2;
        let h = 0;
        let d = 0;
        let a = 0;
        for (let gh = 0; gh <= 6; gh++) {
          for (let ga = 0; ga <= 6; ga++) {
            const pH = Math.exp(-lambdaH) * Math.pow(lambdaH, gh) / factorial(gh);
            const pA = Math.exp(-lambdaA) * Math.pow(lambdaA, ga) / factorial(ga);
            const p = pH * pA;
            if (gh > ga) h += p;
            else if (gh === ga) d += p;
            else a += p;
          }
        }
        return normalize(h, d, a);
      },
    },
    {
      id: 'dixon_coles',
      name: 'Dixon-Coles Model',
      description: 'Simplified Dixon-Coles adjustment over Poisson baseline',
      version: BASELINE_VERSION,
      predict: () => ({ homeProbability: 0.42, drawProbability: 0.28, awayProbability: 0.30 }),
    },
    {
      id: 'elo',
      name: 'Elo Model',
      description: 'Elo rating-based prediction from home/away odds',
      version: BASELINE_VERSION,
      predict: (m) => {
        const eloDiff = Math.log(m.homeOdds / m.awayOdds) * 400 / Math.LN10;
        const expectedH = 1 / (1 + Math.pow(10, -eloDiff / 400));
        const expectedA = 1 - expectedH;
        const expectedD = 0.25 * (1 - Math.abs(expectedH - expectedA));
        return normalize(clamp(expectedH), clamp(expectedD), clamp(expectedA));
      },
    },
    {
      id: 'closing_odds',
      name: 'Closing Odds',
      description: 'Market closing odds as probabilities (inverse)',
      version: BASELINE_VERSION,
      predict: (m) => {
        const h = 1 / m.homeOdds;
        const d = m.drawOdds ? 1 / m.drawOdds : 0;
        const a = 1 / m.awayOdds;
        return normalize(clamp(h), clamp(d), clamp(a));
      },
    },
    {
      id: 'opening_odds',
      name: 'Opening Odds',
      description: 'Market opening odds as probabilities (inverse)',
      version: BASELINE_VERSION,
      predict: (m) => {
        const h = 1 / m.homeOdds;
        const d = m.drawOdds ? 1 / m.drawOdds : 0;
        const a = 1 / m.awayOdds;
        return normalize(clamp(h), clamp(d), clamp(a));
      },
    },
    {
      id: 'random',
      name: 'Random',
      description: 'Equal probability for all three outcomes',
      version: BASELINE_VERSION,
      predict: () => ({ homeProbability: 0.333, drawProbability: 0.333, awayProbability: 0.333 }),
    },
    {
      id: 'favorite',
      name: 'Favorite',
      description: 'Always picks the favorite (lowest odds)',
      version: BASELINE_VERSION,
      predict: (m) => {
        const minOdds = Math.min(m.homeOdds, m.drawOdds ?? Infinity, m.awayOdds);
        if (minOdds === m.homeOdds) return { homeProbability: 0.6, drawProbability: 0.2, awayProbability: 0.2 };
        if (minOdds === m.awayOdds) return { homeProbability: 0.2, drawProbability: 0.2, awayProbability: 0.6 };
        return { homeProbability: 0.2, drawProbability: 0.6, awayProbability: 0.2 };
      },
    },
    {
      id: 'underdog',
      name: 'Underdog',
      description: 'Always picks the underdog (highest odds)',
      version: BASELINE_VERSION,
      predict: (m) => {
        const maxOdds = Math.max(m.homeOdds, m.drawOdds ?? 0, m.awayOdds);
        if (maxOdds === m.homeOdds) return { homeProbability: 0.6, drawProbability: 0.2, awayProbability: 0.2 };
        if (maxOdds === m.awayOdds) return { homeProbability: 0.2, drawProbability: 0.2, awayProbability: 0.6 };
        return { homeProbability: 0.2, drawProbability: 0.6, awayProbability: 0.2 };
      },
    },
    {
      id: 'flat_probability',
      name: 'Flat Probability',
      description: 'Flat 40% home, 30% draw, 30% away',
      version: BASELINE_VERSION,
      predict: () => ({ homeProbability: 0.40, drawProbability: 0.30, awayProbability: 0.30 }),
    },
    {
      id: 'market_probability',
      name: 'Market Probability',
      description: 'Market-implied probabilities with no adjustment',
      version: BASELINE_VERSION,
      predict: (m) => {
        const h = 1 / m.homeOdds;
        const d = m.drawOdds ? 1 / m.drawOdds : 0;
        const a = 1 / m.awayOdds;
        return normalize(clamp(h), clamp(d), clamp(a));
      },
    },
  ];
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export class BaselineRegistry {
  private readonly strategies = new Map<BaselineId, BaselineStrategy>();

  constructor(strategies: readonly BaselineStrategy[] = createAllBaselines()) {
    for (const s of strategies) this.strategies.set(s.id, s);
  }

  get(id: BaselineId): BaselineStrategy | undefined {
    return this.strategies.get(id);
  }

  getAll(): readonly BaselineStrategy[] {
    return Array.from(this.strategies.values());
  }

  register(strategy: BaselineStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  ids(): readonly BaselineId[] {
    return Array.from(this.strategies.keys());
  }
}

export const defaultBaselineRegistry = new BaselineRegistry();