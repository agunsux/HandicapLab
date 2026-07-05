import { IMarketFeature, FeatureResult } from '../interfaces';

export class OddsDispersionFeature implements IMarketFeature {
  public getName(): string {
    return 'OddsDispersion';
  }

  public getVersion(): string {
    return '1.0.0';
  }

  public compute(snapshots: any[], openingOdds: number, closingOdds: number): FeatureResult {
    if (snapshots.length < 2) {
      return { value: 0.0, confidence: 0.0, quality: 0.2, missingInputs: 2, lineage: [] };
    }

    const oddsArray = snapshots.map(s => s.odds);
    const mean = oddsArray.reduce((sum, val) => sum + val, 0) / oddsArray.length;
    const variance = oddsArray.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / oddsArray.length;
    const stdDev = Math.sqrt(variance);

    return {
      value: Number(stdDev.toFixed(4)),
      confidence: 0.95,
      quality: 1.0,
      missingInputs: 0,
      lineage: snapshots.map(s => s.id)
    };
  }
}
