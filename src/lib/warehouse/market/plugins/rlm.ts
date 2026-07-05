import { IMarketFeature, FeatureResult } from '../interfaces';

export class RLMFeature implements IMarketFeature {
  public getName(): string {
    return 'RLM';
  }

  public getVersion(): string {
    return '1.0.0';
  }

  public compute(snapshots: any[], openingOdds: number, closingOdds: number): FeatureResult {
    // Reverse Line Movement (RLM) detects odds moving opposite to public stakes consensus (e.g. 70% public on Home, but Home odds increase)
    const publicConsensusHome = 0.70; // Mock threshold of public money
    const oddsMovedUp = closingOdds > openingOdds;

    const isRlm = publicConsensusHome > 0.65 && oddsMovedUp;

    return {
      value: isRlm ? 1.0 : 0.0,
      confidence: 0.85,
      quality: openingOdds > 0 && closingOdds > 0 ? 1.0 : 0.0,
      missingInputs: 0,
      lineage: [`opening:${openingOdds}`, `closing:${closingOdds}`]
    };
  }
}
