import { IMarketFeature, FeatureResult } from '../interfaces';

export class CLVFeature implements IMarketFeature {
  public getName(): string {
    return 'CLV';
  }

  public getVersion(): string {
    return '1.0.0';
  }

  public compute(snapshots: any[], openingOdds: number, closingOdds: number): FeatureResult {
    if (openingOdds <= 0 || closingOdds <= 0) {
      return { value: 0.0, confidence: 0.0, quality: 0.0, missingInputs: 1, lineage: [] };
    }

    // CLV = (openingOdds / closingOdds) - 1
    const clv = (openingOdds / closingOdds) - 1.0;

    return {
      value: Number(clv.toFixed(4)),
      confidence: 1.0,
      quality: 1.0,
      missingInputs: 0,
      lineage: [`opening:${openingOdds}`, `closing:${closingOdds}`]
    };
  }
}
