import { describe, test, expect } from 'vitest';
import { computeActualSampleSize } from '../src/lib/research/ah-solo/ahValueEngine';

describe('Sample Size Actual Distribution', () => {
  test('sample size reflects actual data distribution', () => {
    const trainingData = [
      ...Array(300).fill({ line: -0.5, leagueId: 'ENG-PL' }),
      ...Array(50).fill({ line: -2.5, leagueId: 'ENG-PL' }),
    ];
    
    const common = computeActualSampleSize(-0.5, 'ENG-PL', trainingData);
    const rare = computeActualSampleSize(-2.5, 'ENG-PL', trainingData);
    
    expect(common).toBe(300);
    expect(rare).toBe(50);
    expect(common).not.toBe(rare); // Proves not hardcoded
    expect(common).not.toBe(500); // Proves not the old constant
  });
});
