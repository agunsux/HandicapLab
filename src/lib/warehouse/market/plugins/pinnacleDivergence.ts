import { IMarketFeature, FeatureResult } from '../interfaces';

export class PinnacleDivergenceFeature implements IMarketFeature {
  public getName(): string {
    return 'PinnacleDivergence';
  }

  public getVersion(): string {
    return '1.0.0';
  }

  public compute(snapshots: any[], openingOdds: number, closingOdds: number): FeatureResult {
    // Computes difference between average market odds and Pinnacle (sharp benchmark) odds
    const pinnacleSnapshot = snapshots.find(s => s.bookmakerId === 'pinnacle');
    const averageSnapshot = snapshots.find(s => s.bookmakerId === 'average');

    if (!pinnacleSnapshot || !averageSnapshot) {
      return { value: 0.0, confidence: 0.0, quality: 0.3, missingInputs: 2, lineage: [] };
    }

    const divergence = pinnacleSnapshot.odds - averageSnapshot.odds;

    return {
      value: Number(divergence.toFixed(4)),
      confidence: 0.95,
      quality: 1.0,
      missingInputs: 0,
      lineage: [pinnacleSnapshot.id, averageSnapshot.id]
    };
  }
}
