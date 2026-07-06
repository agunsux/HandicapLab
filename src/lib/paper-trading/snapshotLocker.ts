// HandicapLab Snapshot Locker (Immutability Layer)
// Location: src/lib/paper-trading/snapshotLocker.ts

import crypto from 'crypto';

export interface ImmutableSnapshot {
  matchId: string;
  timestamp: string;
  odds: {
    home: number;
    draw: number;
    away: number;
    line?: number | null;
  };
  probabilities: {
    home: number;
    draw: number;
    away: number;
  };
  features: any;
  modelVersion: string;
  calibrationVersion: string;
  configHash: string;
  featureHash: string;
  predictionHash: string;
}

export class SnapshotLocker {
  private static snapshots: Map<string, ImmutableSnapshot> = new Map();

  /**
   * Generates a deterministic hash from a JSON serializable object.
   */
  public static calculateHash(obj: any): string {
    const serialized = JSON.stringify(obj || {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Locks a pre-match snapshot.
   * If a snapshot already exists for the given matchId, throws an error to enforce immutability.
   */
  public static lock(
    matchId: string,
    data: Omit<ImmutableSnapshot, 'configHash' | 'featureHash' | 'predictionHash' | 'timestamp'>
  ): ImmutableSnapshot {
    if (this.snapshots.has(matchId)) {
      throw new Error(`[SnapshotLocker] Access Denied: Snapshot for match ${matchId} is locked and immutable.`);
    }

    const timestamp = new Date().toISOString();
    const configHash = this.calculateHash({
      modelVersion: data.modelVersion,
      calibrationVersion: data.calibrationVersion
    });
    const featureHash = this.calculateHash(data.features);
    const predictionHash = this.calculateHash({
      probabilities: data.probabilities,
      odds: data.odds,
      configHash,
      featureHash
    });

    const snapshot: ImmutableSnapshot = {
      ...data,
      timestamp,
      configHash,
      featureHash,
      predictionHash
    };

    this.snapshots.set(matchId, snapshot);
    console.log(`[SnapshotLocker] Immutable snapshot locked for match: ${matchId} | Hash: ${predictionHash}`);

    return snapshot;
  }

  /**
   * Retrieves a locked snapshot by matchId.
   */
  public static get(matchId: string): ImmutableSnapshot | undefined {
    return this.snapshots.get(matchId);
  }

  /**
   * Checks if a snapshot exists.
   */
  public static has(matchId: string): boolean {
    return this.snapshots.has(matchId);
  }

  /**
   * Clears the locked snapshots (for testing purposes).
   */
  public static clear(): void {
    this.snapshots.clear();
  }
}
