export interface ClvResult {
  clv_score: number;
  clv_percentage: number;
  clv_category: 'Elite' | 'Positive' | 'Neutral' | 'Negative';
  line_clv: number;
  price_clv: number;
  total_clv: number;
}

export class CLVCalculator {
  /**
   * Calculates Closing Line Value (CLV) with detailed components.
   */
  public static calculateDetailed(
    marketType: 'ML' | 'AH' | 'OU',
    selection: string,
    openingLine: number,
    openingPrice: number,
    closingLine: number | null | undefined,
    closingPrice: number | null | undefined
  ): ClvResult {
    const defaultResult: ClvResult = {
      clv_score: 0,
      clv_percentage: 0,
      clv_category: 'Neutral',
      line_clv: 0,
      price_clv: 0,
      total_clv: 0
    };

    if (openingPrice <= 1.0) {
      return defaultResult;
    }

    const cPrice = closingPrice && closingPrice > 1.0 ? closingPrice : openingPrice;
    const cLine = closingLine !== null && closingLine !== undefined ? closingLine : openingLine;

    // For ML and OU, if line doesn't change, we use price-based CLV
    if (marketType !== 'AH') {
      const priceClv = (openingPrice / cPrice) - 1.0;
      const pct = priceClv * 100;
      let category: 'Elite' | 'Positive' | 'Neutral' | 'Negative' = 'Neutral';
      if (pct >= 5.0) category = 'Elite';
      else if (pct >= 0.5) category = 'Positive';
      else if (pct <= -0.5) category = 'Negative';

      return {
        clv_score: Number(priceClv.toFixed(4)),
        clv_percentage: Number(pct.toFixed(2)),
        clv_category: category,
        line_clv: 0,
        price_clv: Number(priceClv.toFixed(4)),
        total_clv: Number(priceClv.toFixed(4))
      };
    }

    // Asian Handicap expectation-based CLV
    const isHome = selection.toLowerCase() === 'home';
    const oLineAdj = isHome ? -openingLine : openingLine;
    const cLineAdj = isHome ? -cLine : cLine;

    const openingExpectation = oLineAdj / openingPrice;
    const closingExpectation = cLineAdj / cPrice;
    const midExpectation = cLineAdj / openingPrice; // closing line with opening price

    const lineClv = midExpectation - openingExpectation;
    const priceClv = closingExpectation - midExpectation;
    const totalClv = closingExpectation - openingExpectation;

    const pct = totalClv * 100;
    let category: 'Elite' | 'Positive' | 'Neutral' | 'Negative' = 'Neutral';
    if (pct >= 5.0) category = 'Elite';
    else if (pct >= 0.5) category = 'Positive';
    else if (pct <= -0.5) category = 'Negative';

    return {
      clv_score: Number(totalClv.toFixed(4)),
      clv_percentage: Number(pct.toFixed(2)),
      clv_category: category,
      line_clv: Number(lineClv.toFixed(4)),
      price_clv: Number(priceClv.toFixed(4)),
      total_clv: Number(totalClv.toFixed(4))
    };
  }

  /**
   * Legacy compatibility method
   */
  public static calculate(
    predictionOdds: number,
    closingOdds: number | null | undefined
  ): number | null {
    if (!closingOdds || closingOdds <= 1.0 || predictionOdds <= 1.0) {
      return null;
    }
    const clv = (closingOdds / predictionOdds) - 1.0;
    return Number(clv.toFixed(4));
  }
}

