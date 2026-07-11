/**
 * EPIC 20.9 — Performance Attribution
 * Attributes results to probability, calibration, features, policy, stake, timing, odds.
 */

import type { AttributionResult, AttributionReport } from './types';
import { generateAttributionId } from './id';

export class AttributionEngine {
  attribute(results: readonly { factor: string; contribution: number }[]): AttributionReport {
    const total = Math.abs(results.reduce((s, r) => s + r.contribution, 0)) || 1;
    const entries: AttributionResult[] = results.map((r) => ({
      factor: r.factor,
      contribution: Math.round(r.contribution * 10000) / 10000,
      pct: Math.round((r.contribution / total) * 10000) / 100,
    }));

    return {
      attributionId: generateAttributionId(),
      results: entries,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const defaultAttributionEngine = new AttributionEngine();