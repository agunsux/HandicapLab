export interface FeatureResult {
  value: number;
  confidence: number;
  quality: number;
  missingInputs: number;
  lineage: string[];
}

export interface IMarketFeature {
  getName(): string;
  getVersion(): string;
  compute(snapshots: any[], openingOdds: number, closingOdds: number): FeatureResult;
}
