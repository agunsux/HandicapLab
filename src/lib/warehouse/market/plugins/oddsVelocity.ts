import { IMarketFeature, FeatureResult } from '../interfaces';

export class OddsVelocityFeature implements IMarketFeature {
  public getName(): string {
    return 'OddsVelocity';
  }

  public getVersion(): string {
    return '1.0.0';
  }

  public compute(snapshots: any[], openingOdds: number, closingOdds: number): FeatureResult {
    if (snapshots.length < 2) {
      return { value: 0.0, confidence: 0.0, quality: 0.2, missingInputs: 2 - snapshots.length, lineage: [] };
    }

    // Sort snapshots by timestamp ascending
    const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const timeDeltaHours = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (3600 * 1000);
    if (timeDeltaHours <= 0) {
      return { value: 0.0, confidence: 0.5, quality: 0.5, missingInputs: 0, lineage: [first.id, last.id] };
    }

    const oddsDelta = last.odds - first.odds;
    const velocity = oddsDelta / timeDeltaHours;

    return {
      value: Number(velocity.toFixed(4)),
      confidence: 0.95,
      quality: 1.0,
      missingInputs: 0,
      lineage: [first.id, last.id]
    };
  }
}
