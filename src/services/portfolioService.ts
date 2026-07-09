// Portfolio Management & Optimization Service
// Location: src/services/portfolioService.ts

import { PortfolioOptimizer, CandidateEdge, StakingAllocation } from '../lib/engine/portfolio-optimizer';
import { RiskEngine, RiskBetInput, RiskEngineConfig } from '../lib/engine/risk-engine';
import { MonteCarloEngine } from '../lib/engine/monte-carlo';
import { supabase } from '../lib/supabase.server';

export interface MarketEdgeWithMatch {
  id: string;
  match_id: string;
  market: string;
  selection: string;
  bookmaker: string;
  line: number | null;
  model_probability: number;
  market_probability: number;
  edge_raw: number;
  edge_adjusted: number;
  expected_value: number;
  kelly_fraction: number;
  confidence_score: number;
  market_efficiency: number;
  volatility_score: number;
  recommended_stake: number;
  signal_rank: number;
  explanation_json: Record<string, unknown>;
  created_at: string;
  matches: {
    home_team: string;
    away_team: string;
    league: string;
    kickoff: string;
  } | null;
}

export interface PortfolioRecord {
  id: string;
  bankroll: number;
  risk_tolerance: number;
  max_exposure: number;
  total_weight: number;
  risk_score: number;
  expected_roi: number;
  expected_variance: number;
  max_drawdown_estimate: number;
  staking_model: string;
  allocations_json: unknown;
  created_at: string;
}

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
  public static async generatePortfolio(config: PortfolioConfigInput): Promise<PortfolioRecord | null> {
    try {
      // 1. Retrieve candidate edges
      const { data, error: edgesErr } = await supabase
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

      const edges = data as MarketEdgeWithMatch[] | null;

      if (edgesErr || !edges || edges.length === 0) {
        console.log('[PortfolioService] No candidates found satisfying minimum EV:', config.minEV);
        return null;
      }

      // Filter by confidence
      const filteredEdges = edges.filter(e => e.confidence_score >= config.minConfidence);
      if (filteredEdges.length === 0) return null;

      // Group by match ID and keep only the highest EV candidate per match
      const uniqueMatchCandidates = new Map<string, MarketEdgeWithMatch>();
      for (const e of filteredEdges) {
        if (!uniqueMatchCandidates.has(e.match_id)) {
          uniqueMatchCandidates.set(e.match_id, e);
        }
      }

      const candidatesList = Array.from(uniqueMatchCandidates.values());

      // Map to CandidateEdge format
      const optimizerInput: CandidateEdge[] = candidatesList.map(e => {
        const explanation = e.explanation_json || {};
        const oddsInfo = explanation.oddsInfo as Record<string, unknown> | undefined;
        const odds = Number(oddsInfo?.odds || 1.95);
        return {
          matchId: e.match_id,
          league: e.matches?.league || 'Unknown League',
          kickoff: e.matches?.kickoff || new Date().toISOString(),
          bookmaker: e.bookmaker,
          odds,
          probability: e.model_probability,
          expectedValue: e.expected_value
        };
      });

      // 2. Compute stakes using optimizer model
      let allocations: StakingAllocation[] = [];
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

      const { data: portfolioData, error } = await supabase
        .from('portfolios')
        .insert(portfolioPayload)
        .select()
        .single();

      if (error) {
        console.error('[PortfolioService] Save portfolio error:', error.message);
        return null;
      }

      return portfolioData as PortfolioRecord;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[PortfolioService] generatePortfolio error:', message);
      return null;
    }
  }
}
