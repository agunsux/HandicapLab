/**
 * 21.7 — Daily Research Ledger
 * Immutable research entries for every prediction.
 */

import type { ResearchEntry } from './types';
import { generateLedgerId } from './id';

export class ResearchLedger {
  private readonly entries: ResearchEntry[] = [];

  add(input: { fixtureId: string; snapshotId: string; market: string; predictedProb: number; marketOdds: number; stake: number; actualResult: number; profit: number; closingOdds: number; clv: number; calibrationVersion: string; policyUsed: string; decisionTrace: readonly string[]; researchArtifactIds: readonly string[] }): ResearchEntry {
    const entry: ResearchEntry = Object.freeze({
      entryId: generateLedgerId(),
      fixtureId: input.fixtureId,
      snapshotId: input.snapshotId,
      market: input.market,
      predictedProb: input.predictedProb,
      marketOdds: input.marketOdds,
      stake: input.stake,
      actualResult: input.actualResult,
      profit: input.profit,
      closingOdds: input.closingOdds,
      clv: input.clv,
      calibrationVersion: input.calibrationVersion,
      policyUsed: input.policyUsed,
      decisionTrace: [...input.decisionTrace],
      researchArtifactIds: [...input.researchArtifactIds],
      created_at: new Date().toISOString(),
      immutable: true as const,
    });
    this.entries.push(entry);
    return entry;
  }

  getByFixture(fixtureId: string): readonly ResearchEntry[] { return this.entries.filter((e) => e.fixtureId === fixtureId); }
  getAll(): readonly ResearchEntry[] { return [...this.entries]; }
  count(): number { return this.entries.length; }
}

export const defaultResearchLedger = new ResearchLedger();