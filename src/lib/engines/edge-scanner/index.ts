import { ProbabilityOutput } from '../probability-engine/types';
import { MarketOdds, EdgePick } from './types';
import { ValueDetector } from './value-detector';
import { Kelly } from './kelly';
import { ClvTracker } from './clv-tracker';
import { ConfidenceScanner } from './confidence';

export class EdgeScanner {
  /**
   * Helper to format Asian Handicap line numeric value to the standard string key (e.g., "-0.5", "+1.0").
   */
  private static formatAhLine(line: number): string {
    if (line === 0) return '0.0';
    return line > 0 ? `+${line.toFixed(1)}` : `${line.toFixed(1)}`;
  }

  /**
   * Helper to format Over/Under line numeric value to the standard string key (e.g., "2.5").
   */
  private static formatOuLine(line: number): string {
    return line.toFixed(1);
  }

  /**
   * Main scan function.
   * Compares the model probabilities vs market implied probabilities,
   * detects positive EV picks, calculates stakes, tracks CLV, and assigns tiers.
   * All functions are pure, no database calls, no external APIs.
   * 
   * @param matchId Target match ID
   * @param marketType Target market type ('ML' | 'AH' | 'OU')
   * @param modelOutput ProbabilityOutput from the probability engine
   * @param marketOdds OddsSnapshot / MarketOdds to scan
   * @param closingOdds Optional closing odds to calculate CLV
   * @param minEV Minimum Expected Value threshold to include a pick (default: 0.0)
   */
  public static scan(
    matchId: string,
    marketType: 'ML' | 'AH' | 'OU',
    modelOutput: ProbabilityOutput,
    marketOdds: MarketOdds,
    closingOdds?: MarketOdds,
    minEV: number = 0.0
  ): EdgePick[] {
    const picks: EdgePick[] = [];

    // Helper to evaluate a specific outcome
    const evaluateOutcome = (
      outcome: 'home' | 'draw' | 'away' | 'over' | 'under',
      lineStr: string,
      modelProb: number,
      odds?: number,
      closingOddsValue?: number
    ) => {
      if (odds === undefined || odds <= 1.0 || modelProb <= 0) return;

      const { expectedValue, edge, impliedProbability } = ValueDetector.calculateEdge(modelProb, odds);

      if (ValueDetector.isValue(expectedValue, minEV)) {
        const kellyStake = Kelly.calculateStake(modelProb, odds);
        const clv = ClvTracker.calculateClv(odds, closingOddsValue);
        const confidence = ConfidenceScanner.getConfidence(modelProb);

        // Tier assignment: ELITE (EV >= 15%), PRO (5% <= EV < 15%), FREE (EV < 5%)
        let tier: 'FREE' | 'PRO' | 'ELITE' = 'FREE';
        if (expectedValue >= 0.15) {
          tier = 'ELITE';
        } else if (expectedValue >= 0.05) {
          tier = 'PRO';
        }

        picks.push({
          matchId,
          marketType,
          line: lineStr,
          outcome,
          modelProbability: modelProb,
          marketOdds: odds,
          impliedProbability,
          expectedValue,
          kellyStake,
          clv,
          confidence,
          tier
        });
      }
    };

    if (marketType === 'ML') {
      // Scan 1X2 outcomes
      evaluateOutcome('home', '1X2', modelOutput.pHome, marketOdds.homeOdds, closingOdds?.homeOdds);
      evaluateOutcome('draw', '1X2', modelOutput.pDraw, marketOdds.drawOdds, closingOdds?.drawOdds);
      evaluateOutcome('away', '1X2', modelOutput.pAway, marketOdds.awayOdds, closingOdds?.awayOdds);
    } else if (marketType === 'AH') {
      // Scan Asian Handicap outcomes
      const lineNum = marketOdds.line !== undefined ? marketOdds.line : 0.0;
      const lineKey = this.formatAhLine(lineNum);

      const pHome = modelOutput.pAhHome[lineKey] || 0;
      const pAway = modelOutput.pAhAway[lineKey] || 0;

      evaluateOutcome('home', lineKey, pHome, marketOdds.homeOdds, closingOdds?.homeOdds);
      evaluateOutcome('away', lineKey, pAway, marketOdds.awayOdds, closingOdds?.awayOdds);
    } else if (marketType === 'OU') {
      // Scan Over/Under outcomes
      const lineNum = marketOdds.line !== undefined ? marketOdds.line : 2.5;
      const lineKey = this.formatOuLine(lineNum);

      const pOver = modelOutput.pOver[lineKey] || 0;
      const pUnder = modelOutput.pUnder[lineKey] || 0;

      // For Over/Under, homeOdds represents Over and awayOdds represents Under
      evaluateOutcome('over', lineKey, pOver, marketOdds.homeOdds, closingOdds?.homeOdds);
      evaluateOutcome('under', lineKey, pUnder, marketOdds.awayOdds, closingOdds?.awayOdds);
    }

    // Sort by expected value descending
    return picks.sort((a, b) => b.expectedValue - a.expectedValue);
  }
}
