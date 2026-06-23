export interface ExperimentConfig {
  name: string;
  baseline: {
    modelVersion: string;
    featureVersion: string;
  };
  variants: Array<{
    name: string;
    modelVersion: string;
    featureVersion: string;
  }>;
  dateRange: {
    start: Date;
    end: Date;
  };
  markets: Array<'ML' | 'AH' | 'OU'>;
  leagues?: string[];
}

export interface ComparisonResult {
  variant: string;
  modelVersion: string;
  featureVersion: string;
  metrics: {
    totalPredictions: number;
    winRate: number;
    roi: number;
    avgBrierScore: number;
    avgCLV: number;
    totalProfit: number;
  };
  vsBaseline: {
    winRateDelta: number;
    roiDelta: number;
    brierDelta: number;
    clvDelta: number;
  };
}

export interface FeatureImportanceResult {
  feature: string;
  importance: number;
  impact: 'positive' | 'negative' | 'neutral';
  metricAffected: string;
}
