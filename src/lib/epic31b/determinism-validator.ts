/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Phase 2: Deterministic Reproducibility Validator
 *
 * Verifies that identical inputs produce identical outputs across
 * multiple replay runs. Zero nondeterministic behaviour is allowed.
 */

import crypto from 'crypto';
import type { ReplayOutcome, DeterminismProof } from './types';
import { ProductionReplayRunner } from './league-config';

export class DeterminismValidator {
  /**
   * Run the same replay multiple times and verify identical outputs.
   */
  static async validateDeterminism(
    leagueId: string,
    runCount: number = 3,
    maxMatches?: number
  ): Promise<DeterminismProof> {
    const baselineOutcomes = await new ProductionReplayRunner(42).runLeague(leagueId as any, maxMatches);

    const allOutcomes: ReplayOutcome[][] = [baselineOutcomes.outcomes];

    for (let i = 1; i < runCount; i++) {
      const runner = new ProductionReplayRunner(42);
      const result = await runner.runLeague(leagueId as any, maxMatches);
      allOutcomes.push(result.outcomes);
    }

    let identical = true;
    let maxDiff = 0;
    const fieldsCompared = [
      'predictedProbability',
      'actualResult',
      'profitLoss',
      'brierScore',
      'logLoss',
      'clv',
      'kellyStake',
      'expectedValue',
      'settledOutcome',
      'settlementProfitUnits',
    ];

    for (let runIdx = 1; runIdx < allOutcomes.length; runIdx++) {
      const current = allOutcomes[runIdx];
      const baseline = allOutcomes[0];

      if (current.length !== baseline.length) {
        identical = false;
        break;
      }

      for (let i = 0; i < current.length; i++) {
        const curr = current[i];
        const base = baseline[i];

        for (const field of fieldsCompared) {
          const currVal = (curr as any)[field];
          const baseVal = (base as any)[field];
          const diff = typeof currVal === 'number' && typeof baseVal === 'number'
            ? Math.abs(currVal - baseVal)
            : currVal === baseVal ? 0 : 1;

          if (diff > 1e-9) {
            identical = false;
            if (diff > maxDiff) maxDiff = diff;
          }
        }
      }
    }

    return {
      runId: crypto.randomUUID(),
      runCount,
      identical,
      maxDiff,
      fieldsCompared,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Verify that the same seed produces identical results.
   */
  static async validateSeedReproducibility(leagueId: string): Promise<{
    seed: number;
    run1Hash: string;
    run2Hash: string;
    identical: boolean;
  }> {
    const seed = 42;

    const runner1 = new ProductionReplayRunner(seed);
    const result1 = await runner1.runLeague(leagueId as any);

    const runner2 = new ProductionReplayRunner(seed);
    const result2 = await runner2.runLeague(leagueId as any);

    const hash1 = this.hashOutcomes(result1.outcomes);
    const hash2 = this.hashOutcomes(result2.outcomes);

    return {
      seed,
      run1Hash: hash1,
      run2Hash: hash2,
      identical: hash1 === hash2,
    };
  }

  static hashOutcomes(outcomes: ReplayOutcome[]): string {
    const data = outcomes.map((o) => ({
      f: o.fixtureId,
      p: o.predictedProbability,
      r: o.actualResult,
      pl: o.profitLoss,
      bs: o.brierScore,
      ll: o.logLoss,
      c: o.clv,
      s: o.settledOutcome,
      sp: o.settlementProfitUnits,
    }));
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}
