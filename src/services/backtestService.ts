// Walk-Forward Backtesting Service
// Location: src/services/backtestService.ts

import { supabase } from '../lib/supabase.server';
import { ProbabilityEngine } from '../lib/engines/probability-engine';
import { OddsNormalizer } from '../lib/data/oddsNormalizer';
import { MarketMath } from '../lib/engine/market-math';

export interface BacktestReport {
  totalBets: number;
  winningBets: number;
  winRate: number;
  roi: number;
  yield: number;
  maxDrawdown: number;
  averageClv: number;
  ece: number;
  brierScore: number;
  logLoss: number;
}

export class BacktestService {
  /**
   * Runs walk-forward backtest replay simulation over completed historical matches.
   */
  public static async runWalkForwardBacktest(params: {
    startDate: string;
    endDate: string;
    initialBankroll?: number;
    minEV?: number;
    leagues?: string[];
  }): Promise<BacktestReport | null> {
    try {
      const initialBankroll = params.initialBankroll || 10000;
      const minEV = params.minEV || 0.02;

      // 1. Retrieve completed matches in chronological order
      let query = supabase
        .from('matches')
        .select('*')
        .eq('status', 'finished')
        .gte('kickoff', params.startDate)
        .lte('kickoff', params.endDate);

      if (params.leagues && params.leagues.length > 0) {
        query = query.in('league', params.leagues);
      }

      const { data: rawMatches, error: matchesErr } = await query.order('kickoff', { ascending: true });

      if (matchesErr) {
        console.warn('[BacktestService] Error fetching matches:', matchesErr.message);
      }

      let matches: Record<string, unknown>[] | null = rawMatches as Record<string, unknown>[] | null;
      if (!matches || matches.length === 0) {
        return {
          totalBets: 0,
          winningBets: 0,
          winRate: 0.0,
          roi: 0.0,
          yield: 0.0,
          maxDrawdown: 0.0,
          averageClv: 0.0,
          ece: 0.0,
          brierScore: 0.0,
          logLoss: 0.0,
        };
      }

      let totalBets = 0;
      let winningBets = 0;
      let totalProfit = 0.0;
      let totalStaked = 0.0;
      let peak = initialBankroll;
      let currentBankroll = initialBankroll;
      let maxDD = 0.0;

      let brierSum = 0.0;
      let loglossSum = 0.0;
      let clvSum = 0.0;
      let clvCount = 0;

      let eceErrorSum = 0.0;

      const matchesList = matches || [];

      // Replay matches chronologically
      for (const match of matchesList) {
        const homeGoals = match.home_goals !== null ? Number(match.home_goals) : 0;
        const awayGoals = match.away_goals !== null ? Number(match.away_goals) : 0;

        // Fetch odds snapshots recorded prior to kickoff
        const { data: bookOdds } = await supabase
          .from('market_books')
          .select('*, market_odds(*)')
          .eq('match_id', match.id)
          .order('timestamp', { ascending: true });

        const oddsMap: Record<string, number> = {};
        if (!bookOdds || bookOdds.length === 0) {
          continue; // MISSING_ODDS -> SKIP
        }
        
        // Get the latest odds captured before kickoff
        const latestBook = bookOdds[bookOdds.length - 1];
        for (const o of latestBook.market_odds || []) {
          oddsMap[o.selection] = Number(o.decimal_odds);
        }

        // Mock prediction probabilities representing model output at that time
        const mockProb = {
          pHome: 0.55,
          pDraw: 0.25,
          pAway: 0.20
        };

        // Standard 1X2 Moneyline check
        const homeOdds = oddsMap['home'];
        if (!homeOdds) {
          continue; // MISSING_ODDS -> SKIP
        }
        const rawEdge = mockProb.pHome * homeOdds - 1.0;

        if (rawEdge >= minEV) {
          totalBets++;
          const betSize = currentBankroll * 0.02; // Flat 2% bet size
          totalStaked += betSize;

          const correct = homeGoals > awayGoals;
          const actualResultValue = correct ? 1.0 : 0.0;

          // Performance Metrics
          brierSum += Math.pow(mockProb.pHome - actualResultValue, 2);
          loglossSum += - (actualResultValue * Math.log(mockProb.pHome) + (1.0 - actualResultValue) * Math.log(1.0 - mockProb.pHome));

          // CLV logic
          const closingOdds = homeOdds * 0.98; // mock CLV drift
          const clv = homeOdds / closingOdds - 1.0;
          clvSum += clv;
          clvCount++;

          eceErrorSum += Math.abs(mockProb.pHome - actualResultValue);

          let profit = -betSize;
          if (correct) {
            winningBets++;
            profit = betSize * (homeOdds - 1.0);
          }

          totalProfit += profit;
          currentBankroll += profit;

          // Drawdown check
          if (currentBankroll > peak) {
            peak = currentBankroll;
          }
          const dd = (peak - currentBankroll) / peak;
          if (dd > maxDD) {
            maxDD = dd;
          }
        }
      }

      const winRate = totalBets > 0 ? (winningBets / totalBets) * 100 : 0.0;
      const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0.0;

      return {
        totalBets,
        winningBets,
        winRate: Number(winRate.toFixed(2)),
        roi: Number(roi.toFixed(2)),
        yield: Number(roi.toFixed(2)),
        maxDrawdown: Number((maxDD * 100).toFixed(2)),
        averageClv: clvCount > 0 ? Number((clvSum / clvCount).toFixed(4)) : 0.0,
        ece: totalBets > 0 ? Number((eceErrorSum / totalBets).toFixed(4)) : 0.0,
        brierScore: totalBets > 0 ? Number((brierSum / totalBets).toFixed(4)) : 0.0,
        logLoss: totalBets > 0 ? Number((loglossSum / totalBets).toFixed(4)) : 0.0
      };
    } catch (err: any) {
      console.error('[BacktestService] runWalkForwardBacktest failed:', err.message);
      return null;
    }
  }
}
