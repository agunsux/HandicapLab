import { IMarketFeature, FeatureResult } from '../interfaces';

export class MarketPressureFeature implements IMarketFeature {
  public getName(): string {
    return 'MarketPressure';
  }

  public getVersion(): string {
    return '1.0.0';
  }

  public compute(snapshots: any[], openingOdds: number, closingOdds: number): FeatureResult {
    // Calculates market consensus direction based on the ratio of dropping odds snapshots
    const drops = snapshots.filter(s => s.oddsDropPct && s.oddsDropPct > 0);
    const pressureRatio = snapshots.length > 0 ? drops.length / snapshots.length : 0.5;

    return {
      value: Number(pressureRatio.toFixed(4)),
      confidence: 0.88,
      quality: snapshots.length > 0 ? 1.0 : 0.0,
      missingInputs: snapshots.length === 0 ? 1 : 0,
      lineage: snapshots.map(s => s.id)
    };
  }
}
