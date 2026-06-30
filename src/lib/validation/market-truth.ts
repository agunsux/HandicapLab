import { ReferenceBook, DEFAULT_REFERENCE_BOOK, isValidReferenceBook } from '../settlement/reference-provider';

export interface MarketTruthInput {
  openingOdds?: number;
  referenceBookmaker?: string;
  oddsTimestamp?: string | number | Date;
  kickoffUtc?: string | number | Date;
  marketSuspended?: boolean;
  liquidityScore?: number; // 0-100
  lineMovementQuality?: number; // 0-100
}

export interface MarketTruthResult {
  score: number;
  category: 'excellent' | 'usable' | 'low confidence';
  isValid: boolean;
  errors: string[];
}

export class MarketTruthScanner {
  /**
   * Evaluates input fields, computes a Market Truth Score, and runs structural validation guards.
   */
  public static evaluate(input: MarketTruthInput): MarketTruthResult {
    const errors: string[] = [];
    
    // Phase 4 Guards / Rejections
    if (!input.openingOdds || input.openingOdds <= 1.0) {
      errors.push('missing opening odds');
    }

    if (!input.referenceBookmaker) {
      errors.push('missing reference bookmaker');
    } else if (!isValidReferenceBook(input.referenceBookmaker)) {
      errors.push('invalid reference bookmaker');
    }

    if (!input.oddsTimestamp) {
      errors.push('odds timestamp invalid');
    } else {
      const ts = new Date(input.oddsTimestamp).getTime();
      if (isNaN(ts) || ts <= 0) {
        errors.push('odds timestamp invalid');
      }
    }

    if (input.marketSuspended) {
      errors.push('market suspended');
    }

    if (input.kickoffUtc) {
      const kickoff = new Date(input.kickoffUtc).getTime();
      const oddsTime = input.oddsTimestamp ? new Date(input.oddsTimestamp).getTime() : 0;
      const now = Date.now();

      if (!isNaN(kickoff) && kickoff > 0) {
        // Allow a grace period of 60 seconds for kickoff validation (handles test runs and slight clock drift)
        if (now - kickoff > 60000) {
          errors.push('fixture started');
        }
        // Allow a grace period of 2 seconds for odds vs kickoff validation
        if (oddsTime - kickoff > 2000) {
          errors.push('odds timestamp is after kickoff');
        }
      }
    }

    // If validation fails, return score 0 and invalid
    if (errors.length > 0) {
      return {
        score: 0,
        category: 'low confidence',
        isValid: false,
        errors
      };
    }

    // Derived Market Truth Score Calculation
    // Base defaults
    const isRefBookAvailable = input.referenceBookmaker && input.referenceBookmaker.toUpperCase() === 'PINNACLE';
    const refBookWeight = isRefBookAvailable ? 35 : 15; // 35 points if Pinnacle
    
    // Odds freshness: score based on difference between kickoff/now and odds timestamp
    let freshnessPoints = 25;
    if (input.oddsTimestamp && input.kickoffUtc) {
      const oddsTime = new Date(input.oddsTimestamp).getTime();
      const kickoff = new Date(input.kickoffUtc).getTime();
      const hoursToKickoff = (kickoff - oddsTime) / (1000 * 60 * 60);

      // fresh if captured within 12 hours of kickoff
      if (hoursToKickoff < 0) {
        freshnessPoints = 0;
      } else if (hoursToKickoff > 72) {
        freshnessPoints = 10; // too early
      } else if (hoursToKickoff > 24) {
        freshnessPoints = 20;
      }
    }

    // Liquidity points: 0-20 points based on liquidityScore input (defaults to 20/high)
    const liquidityPoints = input.liquidityScore !== undefined 
      ? Math.min(20, Math.max(0, (input.liquidityScore / 100) * 20))
      : 20;

    // Line movement quality: 0-20 points based on lineMovementQuality input (defaults to 20/stable)
    const movementPoints = input.lineMovementQuality !== undefined
      ? Math.min(20, Math.max(0, (input.lineMovementQuality / 100) * 20))
      : 20;

    const totalScore = Math.round(refBookWeight + freshnessPoints + liquidityPoints + movementPoints);

    let category: 'excellent' | 'usable' | 'low confidence' = 'low confidence';
    if (totalScore >= 90) {
      category = 'excellent';
    } else if (totalScore >= 70) {
      category = 'usable';
    }

    return {
      score: totalScore,
      category,
      isValid: totalScore >= 70,
      errors: []
    };
  }

  /**
   * Helper to compute unified confidence score
   */
  public static calculateConfidence(dataQuality: number, modelConfidence: number, marketLiquidity: number): number {
    // Confidence = (data quality * 0.3) + (model confidence * 0.4) + (market liquidity * 0.3)
    const score = (dataQuality * 0.3) + (modelConfidence * 0.4) + (marketLiquidity * 0.3);
    return Number(score.toFixed(2));
  }
}
