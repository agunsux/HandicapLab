export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  factors: RiskFactor[];
  recommendation: string;
}

export interface RiskFactor {
  name: string;
  score: number;
  impact: 'low' | 'medium' | 'high';
}

export function assessRisk(confidence: number, volatility: number, marketStability: number, sampleSize: number, ece: number): RiskAssessment {
  const factors: RiskFactor[] = [];
  factors.push({ name: 'Confidence', score: Math.max(0, 100 - confidence), impact: confidence < 50 ? 'high' : 'medium' });
  factors.push({ name: 'Prediction Variance', score: Math.min(100, volatility * 200), impact: volatility > 0.2 ? 'high' : 'medium' });
  factors.push({ name: 'Market Stability', score: Math.max(0, 100 - marketStability), impact: marketStability < 40 ? 'high' : 'low' });
  factors.push({ name: 'Sample Size', score: Math.max(0, 100 - Math.min(100, sampleSize / 10)), impact: sampleSize < 200 ? 'high' : 'low' });
  factors.push({ name: 'Calibration', score: Math.min(100, ece * 2000), impact: ece > 0.05 ? 'high' : 'low' });

  const totalScore = factors.reduce((s, f) => s + f.score, 0) / factors.length;
  const highCount = factors.filter((f) => f.impact === 'high').length;
  const level: RiskLevel = totalScore < 25 && highCount === 0 ? 'low' : totalScore < 50 ? 'medium' : totalScore < 75 ? 'high' : 'extreme';

  const recommendation = level === 'low' ? 'Standard position sizing is appropriate.' : level === 'medium' ? 'Consider reduced position sizing.' : level === 'high' ? 'Significant risk — small positions only.' : 'Extreme risk — avoid or minimal exposure.';

  return { level, score: Math.round(totalScore), factors, recommendation };
}
