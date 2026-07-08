import { GoldenBaseline, HealthSnapshot } from './types';

/**
 * Layer 2: Golden Baseline Registry
 *
 * Versioned, approved baselines. Drift is always compared against
 * an approved golden baseline — not against yesterday's data.
 * This prevents the "boiling frog" problem of gradually shifting
 * reference points masking slow model decay.
 *
 * In production, reads/writes persist to the `golden_baselines` table.
 * The in-memory store here enables testing without a live DB.
 */

const registry: GoldenBaseline[] = [];

export class GoldenBaselineRegistry {
  /**
   * Register a new approved baseline.
   */
  static register(baseline: GoldenBaseline): GoldenBaseline {
    // Mark all previous as inactive when a new one is approved
    for (const b of registry) b['is_active'] = false;

    const entry: GoldenBaseline & { is_active: boolean } = {
      ...baseline,
      id: Math.random().toString(36).substring(7),
      approvedAt: baseline.approvedAt ?? new Date(),
      is_active: true,
    };
    registry.push(entry);
    return entry;
  }

  /**
   * Returns the currently active (most recently approved) golden baseline.
   */
  static getActive(): GoldenBaseline | null {
    return [...registry].reverse().find((b) => (b as any).is_active) ?? null;
  }

  /**
   * Returns a specific baseline by version string.
   */
  static getByVersion(version: string): GoldenBaseline | null {
    return registry.find((b) => b.version === version) ?? null;
  }

  /**
   * Lists all registered baselines.
   */
  static listAll(): GoldenBaseline[] {
    return [...registry];
  }

  /**
   * Convenience: builds a GoldenBaseline record from an approved HealthSnapshot.
   */
  static fromSnapshot(
    snapshot: HealthSnapshot,
    version: string,
    opts: { league?: string; season?: string; approvedBy?: string; calibrationMethod: string; notes?: string }
  ): GoldenBaseline {
    return {
      version,
      league: opts.league,
      season: opts.season,
      approvedAt: new Date(),
      approvedBy: opts.approvedBy,
      modelVersion: snapshot.modelVersion,
      calibrationMethod: opts.calibrationMethod,
      snapshot,
      notes: opts.notes,
    };
  }
}
