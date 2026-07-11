/**
 * EPIC 20.5 — Risk Intelligence
 * Measures portfolio, market, league exposure, VaR, CVaR.
 */

import type { RiskProfile } from './types';

export class RiskEngine {
  assess(activeBets: readonly { market: string; league: string; stake: number; odds: number }[], bankroll: number): RiskProfile {
    const totalExposure = activeBets.reduce((s, b) => s + b.stake, 0);
    const portfolioExposure = bankroll > 0 ? totalExposure / bankroll : 0;

    const marketExposure: Record<string, number> = {};
    const leagueExposure: Record<string, number> = {};
    for (const b of activeBets) {
      marketExposure[b.market] = (marketExposure[b.market] ?? 0) + b.stake;
      leagueExposure[b.league] = (leagueExposure[b.league] ?? 0) + b.stake;
    }

    const stakes = activeBets.map((b) => b.stake);
    const meanStake = stakes.reduce((s, v) => s + v, 0) / (stakes.length || 1);
    const variance = stakes.reduce((s, v) => s + Math.pow(v - meanStake, 2), 0) / (stakes.length || 1);
    const volatility = Math.sqrt(variance);

    const sorted = [...activeBets].sort((a, b) => a.stake - b.stake);
    const varIdx = Math.floor(sorted.length * 0.05);
    const valueAtRisk = sorted.slice(0, Math.max(1, varIdx)).reduce((s, b) => s + b.stake, 0);
    const cvarValues = sorted.slice(0, Math.max(1, varIdx));
    const conditionalVaR = cvarValues.length > 0 ? cvarValues.reduce((s, b) => s + b.stake, 0) / cvarValues.length : 0;

    return {
      portfolioExposure: Math.round(portfolioExposure * 10000) / 10000,
      marketExposure,
      leagueExposure,
      correlationRisk: 0,
      concentrationRisk: activeBets.length > 0 ? Math.max(...Object.values(marketExposure)) / totalExposure : 0,
      volatility: Math.round(volatility * 10000) / 10000,
      variance: Math.round(variance * 10000) / 10000,
      maxDrawdownProjection: portfolioExposure * 0.5,
      valueAtRisk: Math.round(valueAtRisk * 10000) / 10000,
      conditionalVaR: Math.round(conditionalVaR * 10000) / 10000,
    };
  }
}

export const defaultRiskEngine = new RiskEngine();