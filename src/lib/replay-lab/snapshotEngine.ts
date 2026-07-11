/**
 * EPIC 16.6 — Prediction Snapshot Engine
 * Persists every prediction as an immutable snapshot.
 */

import type { ReplayOutcome } from '../replay/types';
import type { PredictionSnapshot, SnapshotStoreStats } from './types';
import { generateSnapshotId, simpleHash } from './id';

export interface CreateSnapshotInput {
  readonly sessionId: string;
  readonly fixtureId: string;
  readonly timestamp: string;
  readonly market: string;
  readonly homeProbability: number;
  readonly drawProbability: number;
  readonly awayProbability: number;
  readonly confidence: number;
  readonly homeOdds?: number | null;
  readonly drawOdds?: number | null;
  readonly awayOdds?: number | null;
  readonly edge?: number | null;
  readonly decision?: string | null;
  readonly stake?: number | null;
  readonly expectedValue?: number | null;
  readonly featureVectorHash?: string | null;
  readonly modelHash?: string | null;
  readonly baselineId?: string | null;
}

export class SnapshotEngine {
  private readonly snapshots: PredictionSnapshot[] = [];

  capture(input: CreateSnapshotInput): PredictionSnapshot {
    const predictionFields = [
      input.fixtureId, input.market,
      input.homeProbability.toFixed(6), input.drawProbability.toFixed(6), input.awayProbability.toFixed(6),
      input.confidence.toFixed(6),
      input.baselineId ?? 'none',
    ].join('|');
    const snapshot: PredictionSnapshot = Object.freeze({
      snapshotId: generateSnapshotId(),
      sessionId: input.sessionId,
      fixtureId: input.fixtureId,
      timestamp: input.timestamp,
      market: input.market,
      homeProbability: input.homeProbability,
      drawProbability: input.drawProbability,
      awayProbability: input.awayProbability,
      confidence: input.confidence,
      homeOdds: input.homeOdds ?? null,
      drawOdds: input.drawOdds ?? null,
      awayOdds: input.awayOdds ?? null,
      edge: input.edge ?? null,
      decision: input.decision ?? null,
      stake: input.stake ?? null,
      expectedValue: input.expectedValue ?? null,
      featureVectorHash: input.featureVectorHash ?? null,
      modelHash: input.modelHash ?? null,
      baselineId: input.baselineId ?? null,
      predictionHash: simpleHash(predictionFields),
    });
    this.snapshots.push(snapshot);
    return snapshot;
  }

  captureFromOutcome(
    outcome: ReplayOutcome,
    sessionId: string,
    meta: {
      homeProbability: number;
      drawProbability: number;
      awayProbability: number;
      confidence: number;
      homeOdds?: number | null;
      drawOdds?: number | null;
      awayOdds?: number | null;
      baselineId?: string | null;
    }
  ): PredictionSnapshot {
    return this.capture({
      sessionId,
      fixtureId: outcome.matchId,
      timestamp: new Date().toISOString(),
      market: outcome.marketType,
      homeProbability: meta.homeProbability,
      drawProbability: meta.drawProbability,
      awayProbability: meta.awayProbability,
      confidence: meta.confidence,
      homeOdds: meta.homeOdds,
      drawOdds: meta.drawOdds,
      awayOdds: meta.awayOdds,
      edge: outcome.clv,
      decision: outcome.selection,
      stake: Math.abs(outcome.profitLoss > 0 ? outcome.profitLoss : 0),
      expectedValue: outcome.profitLoss,
      baselineId: meta.baselineId,
    });
  }

  getBySession(sessionId: string): readonly PredictionSnapshot[] {
    return this.snapshots.filter((s) => s.sessionId === sessionId);
  }

  getByFixture(fixtureId: string): readonly PredictionSnapshot[] {
    return this.snapshots.filter((s) => s.fixtureId === fixtureId);
  }

  getAll(): readonly PredictionSnapshot[] {
    return [...this.snapshots];
  }

  getStats(): SnapshotStoreStats {
    const sessions = new Set(this.snapshots.map((s) => s.sessionId));
    const fixtures = new Set(this.snapshots.map((s) => s.fixtureId));
    const models = new Set(this.snapshots.map((s) => s.modelHash ?? s.baselineId ?? 'unknown'));
    return {
      totalSnapshots: this.snapshots.length,
      uniqueSessions: sessions.size,
      uniqueFixtures: fixtures.size,
      uniqueModels: models.size,
    };
  }
}

export const defaultSnapshotEngine = new SnapshotEngine();