import { IMarketFeature, FeatureResult } from '../interfaces';

export class SteamMoveFeature implements IMarketFeature {
  public getName(): string {
    return 'SteamMove';
  }

  public getVersion(): string {
    return '1.0.0';
  }

  public compute(snapshots: any[], openingOdds: number, closingOdds: number): FeatureResult {
    // A steam move occurs when odds drop suddenly across multiple bookmakers
    const sharpDrops = snapshots.filter(s => s.oddsDropPct && s.oddsDropPct > 5.0);
    const uniqueBookmakers = new Set(sharpDrops.map(s => s.bookmakerId));

    const isSteam = uniqueBookmakers.size >= 3;

    return {
      value: isSteam ? 1.0 : 0.0,
      confidence: 0.90,
      quality: snapshots.length > 5 ? 1.0 : 0.6,
      missingInputs: Math.max(0, 5 - snapshots.length),
      lineage: Array.from(uniqueBookmakers).map(bId => `bookmaker:${bId}`)
    };
  }
}
