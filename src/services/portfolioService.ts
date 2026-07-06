// Portfolio Management & Optimization Service
// Location: src/services/portfolioService.ts

import { PortfolioOptimizer, CandidateEdge } from '../lib/engine/portfolio-optimizer';
import { RiskEngine, RiskBetInput, RiskEngineConfig } from '../lib/engine/risk-engine';
import { MonteCarloEngine } from '../lib/engine/monte-carlo';
import { supabase } from '../lib/supabase.server';

export interface PortfolioConfigInput {
  bankroll: number;
  riskTolerance: number;
  maxExposure: number;
  maxLeagueExposure: number;
  maxBookmakerExposure: number;
  minConfidence: number;
  minEV: number;
  stakingModel: 'flat' | 'kelly' | 'half_kelly' | 'quarter_kelly' | 'risk_parity';
}

export class PortfolioService {
  /**
   * Generates, optimizes, and simulates an active portfolio allocation for upcoming matches.
   */
  public static async generatePortfolio(config: PortfolioConfigInput): Promise<any> {
    try {
      // 1. Retrieve candidate edges
      const { data: edges, error: edgesErr } = await supabase
        .from('market_edges')
        .select(`
          *,
          matches (
            home_team,
            away_team,
            league,
            kickoff
          )
        `)
        .gte('expected_value', config.minEV)
        .order('expected_value', { ascending: false });

      if (edgesErr || !edges || edges.length === 0) {
        console.log('[PortfolioService] No candidates found satisfying minimum EV:', config.minEV);
        return null;
      }

      // Filter by confidence
      const filteredEdges = edges.filter(e => e.confidence_score >= config.minConfidence);
      if (filteredEdges.length === 0) return null;

      // Group by match ID and keep only the highest EV candidate per match
      const uniqueMatchCandidates = new Map<string, any>();
      for (const e of filteredEdges) {
        if (!uniqueMatchCandidates.has(e.match_id)) {
          uniqueMatchCandidates.set(e.match_id, e);
        }
      }

      const candidatesList = Array.from(uniqueMatchCandidates.values());

      // Map to CandidateEdge format
      const optimizerInput: CandidateEdge[] = candidatesList.map(e => ({
        matchId: e.match_id,
        league: e.matches?.league || 'Unknown League',
        kickoff: e.matches?.kickoff || new Date().toISOString(),
        bookmaker: e.bookmaker,
        odds: Number(e.explanation_json?.oddsInfo?.odds || 1.95),
        probability: e.model_probability,
        expectedValue: e.expected_value
      }));

      // 2. Compute stakes using optimizer model
      let allocations: any[] = [];
      if (config.stakingModel === 'flat') {
        allocations = PortfolioOptimizer.flatStaking(optimizerInput, config.riskTolerance);
      } else if (config.stakingModel === 'kelly') {
        allocations = PortfolioOptimizer.kellyStaking(optimizerInput, 1.0);
      } else if (config.stakingModel === 'half_kelly') {
        allocations = PortfolioOptimizer.kellyStaking(optimizerInput, 0.5);
      } else if (config.stakingModel === 'quarter_kelly') {
        allocations = PortfolioOptimizer.kellyStaking(optimizerInput, 0.25);
      } else if (config.stakingModel === 'risk_parity') {
        allocations = PortfolioOptimizer.riskParityStaking(optimizerInput, config.maxExposure);
      }

      // Map to RiskBetInput format
      const riskInputs: RiskBetInput[] = allocations.map(a => ({
        matchId: a.matchId,
        league: a.league,
        kickoff: a.kickoff,
        bookmaker: a.bookmaker,
        weight: a.weight
      }));

      // 3. Enforce Risk bounds
      const riskConfig: RiskEngineConfig = {
        maxExposure: config.maxExposure,
        maxLeagueExposure: config.maxLeagueExposure,
        maxBookmakerExposure: config.maxBookmakerExposure
      };

      const scaledRiskInputs = RiskEngine.scaleToLimits(riskInputs, riskConfig);

      // Map back to allocations with updated weights
      const finalAllocations = allocations.map((a, i) => ({
        ...a,
        weight: scaledRiskInputs[i].weight,
        stake_amount: scaledRiskInputs[i].weight * config.bankroll
      })).filter(a => a.weight > 0.0);

      if (finalAllocations.length === 0) return null;

      // 4. Run Monte Carlo simulation paths on final weights
      const mcBets = finalAllocations.map(a => ({
        probability: a.probability,
        odds: a.odds,
        weight: a.weight
      }));

      const mcReport = MonteCarloEngine.simulate({
        bets: mcBets,
        initialBankroll: config.bankroll,
        numPaths: 10000
      });

      // Calculate total portfolio weight
      const totalWeight = finalAllocations.reduce((sum, a) => sum + a.weight, 0);

      // Save portfolio to DB
      const portfolioPayload = {
        bankroll: config.bankroll,
        risk_tolerance: config.riskTolerance,
        max_exposure: config.maxExposure,
        total_weight: totalWeight,
        risk_score: mcReport.var95Percent, // 95% Var as proxy risk score
        expected_roi: mcReport.expectedReturnPercent / 100,
        expected_variance: mcReport.expectedVariance,
        max_drawdown_estimate: mcReport.maxDrawdownEstimate,
        staking_model: config.stakingModel,
        allocations_json: finalAllocations
      };

      const { data, error } = await supabase
        .from('portfolios')
        .insert(portfolioPayload)
        .select()
        .single();

      if (error) {
        console.error('[PortfolioService] Save portfolio error:', error.message);
        return null;
      }

      return data;
    } catch (err: any) {
      console.error('[PortfolioService] generatePortfolio error:', err.message);
      return null;
    }
  }
}
