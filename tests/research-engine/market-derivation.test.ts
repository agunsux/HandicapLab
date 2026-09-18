import { describe, it, expect } from 'vitest';
import { MarketDerivationEngine } from '../../src/lib/research/probability/marketDerivation';
import { BivariateScoreDistribution } from '../../src/lib/research/probability/types';

describe('Phase 2: Market Derivation Engine Tests', () => {
  // Construct a deterministic mock 3x3 score grid
  // (0,0)=0.10, (1,0)=0.25, (0,1)=0.15, (1,1)=0.20, (2,0)=0.10, (0,2)=0.05, (2,1)=0.10, (1,2)=0.05
  // Total sum = 1.00
  const matrix: number[][] = [
    [0.10, 0.15, 0.05],
    [0.25, 0.20, 0.05],
    [0.10, 0.10, 0.00],
  ];

  const dist: BivariateScoreDistribution = {
    matrix,
    maxGoals: 2,
    homeLambda: 1.15,
    awayLambda: 0.85,
    rho: -0.05,
    sum: 1.0,
  };

  it('1. Derives 1X2 Moneyline with zero discrepancy (sum == 1.0)', () => {
    const ml = MarketDerivationEngine.deriveMoneyline(dist);

    // Home wins: (1,0)=0.25, (2,0)=0.10, (2,1)=0.10 => 0.45
    // Draws: (0,0)=0.10, (1,1)=0.20, (2,2)=0.00 => 0.30
    // Away wins: (0,1)=0.15, (0,2)=0.05, (1,2)=0.05 => 0.25
    expect(ml.pHome).toBeCloseTo(0.45, 3);
    expect(ml.pDraw).toBeCloseTo(0.30, 3);
    expect(ml.pAway).toBeCloseTo(0.25, 3);

    expect(ml.pHome + ml.pDraw + ml.pAway).toBeCloseTo(1.0, 4);
    expect(ml.fairOddsHome).toBeCloseTo(1 / 0.45, 2);
  });

  it('2. Derives Asian Handicap with exact symmetry across whole and quarter lines', () => {
    // Line 0.0 (Pick / Draw No Bet)
    const ah0 = MarketDerivationEngine.deriveAsianHandicap(dist, 0.0);
    expect(ah0.pWin).toBeCloseTo(0.45, 3);
    expect(ah0.pPush).toBeCloseTo(0.30, 3);
    expect(ah0.pLoss).toBeCloseTo(0.25, 3);
    expect(ah0.pHalfWin).toBe(0.0);
    expect(ah0.pHalfLoss).toBe(0.0);

    // Line -0.25
    const ahMinusQuarter = MarketDerivationEngine.deriveAsianHandicap(dist, -0.25);
    // On diff 0 (draw), ED = -0.25 -> Half Loss. So pHalfLoss should equal pDraw = 0.30
    expect(ahMinusQuarter.pHalfLoss).toBeCloseTo(0.30, 3);
    expect(ahMinusQuarter.pWin).toBeCloseTo(0.45, 3);
    expect(ahMinusQuarter.pLoss).toBeCloseTo(0.25, 3);

    // Line +0.25
    const ahPlusQuarter = MarketDerivationEngine.deriveAsianHandicap(dist, 0.25);
    // On diff 0 (draw), ED = +0.25 -> Half Win. So pHalfWin should equal pDraw = 0.30
    expect(ahPlusQuarter.pHalfWin).toBeCloseTo(0.30, 3);
    expect(ahPlusQuarter.pWin).toBeCloseTo(0.45, 3);
    expect(ahPlusQuarter.pLoss).toBeCloseTo(0.25, 3);
  });

  it('3. Derives Over/Under whole, half, and quarter lines correctly', () => {
    // Total goals distribution:
    // T=0: (0,0)=0.10
    // T=1: (1,0)+(0,1) = 0.25+0.15 = 0.40
    // T=2: (2,0)+(1,1)+(0,2) = 0.10+0.20+0.05 = 0.35
    // T=3: (2,1)+(1,2) = 0.10+0.05 = 0.15
    // Total = 0.10 + 0.40 + 0.35 + 0.15 = 1.00

    // Line 1.5 (Half line)
    const ou15 = MarketDerivationEngine.deriveOverUnder(dist, 1.5);
    // Over 1.5: T=2 (0.35) + T=3 (0.15) = 0.50
    // Under 1.5: T=0 (0.10) + T=1 (0.40) = 0.50
    expect(ou15.over.pWin).toBeCloseTo(0.50, 3);
    expect(ou15.under.pWin).toBeCloseTo(0.50, 3);

    // Line 2.0 (Whole line)
    const ou20 = MarketDerivationEngine.deriveOverUnder(dist, 2.0);
    // Push on T=2 (0.35)
    expect(ou20.over.pPush).toBeCloseTo(0.35, 3);
    expect(ou20.under.pPush).toBeCloseTo(0.35, 3);
    // Over 2.0 Win: T=3 (0.15)
    expect(ou20.over.pWin).toBeCloseTo(0.15, 3);
    // Under 2.0 Win: T=0 (0.10) + T=1 (0.40) = 0.50
    expect(ou20.under.pWin).toBeCloseTo(0.50, 3);
  });

  it('4. Derives Both Teams To Score (BTTS) probabilities correctly', () => {
    const btts = MarketDerivationEngine.deriveBtts(dist);
    // h>=1 and a>=1: (1,1)=0.20, (1,2)=0.05, (2,1)=0.10 => 0.35
    expect(btts.pYes).toBeCloseTo(0.35, 3);
    expect(btts.pNo).toBeCloseTo(0.65, 3);
    expect(btts.pYes + btts.pNo).toBeCloseTo(1.0, 4);
  });
});

