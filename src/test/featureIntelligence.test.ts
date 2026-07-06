import { describe, it, expect } from 'vitest';
import { LeakageScanner } from '../lib/feature-intelligence/leakageScanner';
import { RankingEngine } from '../lib/feature-intelligence/rankingEngine';

describe('Sprint 30.5 - Feature Intelligence', () => {
  it('should detect leakage if correlation is impossibly high', () => {
    // Exact same as target -> leakage
    const target = [1, 0, 1, 1, 0, 0, 1];
    const feature = [1, 0, 1, 1, 0, 0, 1];
    
    const result = LeakageScanner.scan({} as any, feature, target);
    expect(result.isLeaking).toBe(true);
    expect(result.reason).toContain('Impossibly high correlation');
  });

  it('should not detect leakage for normal features', () => {
    const target =  [1, 0, 1, 1, 0, 0, 1];
    const feature = [0, 0, 1, 0, 0, 1, 1];
    
    const result = LeakageScanner.scan({} as any, feature, target);
    expect(result.isLeaking).toBe(false);
  });

  it('should rank features via multi-objective composite scoring', () => {
    const features = {
      'featA': {
        predictiveImportance: 0.9,
        stability: 0.8,
        driftResistance: 0.5,
        dataQuality: 0.9,
        coverage: 1.0,
        computationalCost: 0.8,
        explainability: 1.0
      },
      'featB': { // Super predictive but terrible stability and cost
        predictiveImportance: 1.0,
        stability: 0.1,
        driftResistance: 0.1,
        dataQuality: 0.5,
        coverage: 0.5,
        computationalCost: 0.1,
        explainability: 0.1
      }
    };

    const ranked = RankingEngine.rankFeatures(features);
    // featA should beat featB because of the composite score
    expect(ranked[0].featureId).toBe('featA');
    expect(ranked[1].featureId).toBe('featB');
  });
});
