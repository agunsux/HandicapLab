// HandicapLab Market Intelligence - Market Efficiency Metrics
// Location: src/lib/market/efficiencyMetrics.ts

import { OddsSnapshot } from './providerInterface';

export interface EfficiencyResult {
  closingLineEfficiency: number; // 0-1
  priceDiscoverySpeed: number; // speed score 0-100
  consensusSpread: number; // range / standard deviation
  liquidityProxy: 'High' | 'Medium' | 'Low';
}

export class EfficiencyMetrics {
  /**
   * Evaluates Price Discovery, Consensus Spread, and Liquidity details.
   */
  public static evaluate(
    bookmakerOdds: Record<string, OddsSnapshot>,
    closingLineEfficiencyScore: number = 0.85
  ): EfficiencyResult {
    const providerOdds = Object.values(bookmakerOdds);
    if (providerOdds.length === 0) {
      return {
        closingLineEfficiency: 0.5,
        priceDiscoverySpeed: 50,
        consensusSpread: 0,
        liquidityProxy: 'Low'
      };
    }

    const homeOddsList = providerOdds.map((o) => o.home);
    const maxOdds = Math.max(...homeOddsList);
    const minOdds = Math.min(...homeOddsList);
    const consensusSpread = maxOdds - minOdds;

    // Price Discovery Speed: based on spread tightness (smaller spread implies faster discovery)
    const discoveryScore = Math.max(0, Math.min(100, Math.round(100 - (consensusSpread * 200))));

    // Liquidity Proxy: High if Pin/PS3838 are present, else Medium/Low
    let liquidityProxy: 'High' | 'Medium' | 'Low' = 'Medium';
    if (bookmakerOdds['Pinnacle'] || bookmakerOdds['PS3838']) {
      liquidityProxy = 'High';
    } else if (providerOdds.length < 2) {
      liquidityProxy = 'Low';
    }

    return {
      closingLineEfficiency: Number(closingLineEfficiencyScore.toFixed(2)),
      priceDiscoverySpeed: discoveryScore,
      consensusSpread: Number(consensusSpread.toFixed(4)),
      liquidityProxy
    };
  }
}
