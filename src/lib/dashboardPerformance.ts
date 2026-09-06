import { getTerminalPredictions } from './terminalData';
import { supabase } from './supabase.server';

export interface MarketPerformance {
  market: string;
  name: string;
  bets: number;
  won: number;
  lost: number;
  pushes: number;
  winRate: number;
  yieldPct: number;
  totalProfit: number;
}

export interface UserDashboardPerformance {
  hasData: boolean;
  totalBets: number;
  won: number;
  lost: number;
  pushes: number;
  winRate: number;
  yieldRoi: number;
  totalProfit: number;
  byMarket: {
    asianHandicap: MarketPerformance;
    overUnder: MarketPerformance;
    btts: MarketPerformance;
  };
  recentSettled: Array<{
    id: string;
    date: string;
    match: string;
    market: string;
    pick: string;
    odds: number;
    result: string;
    profitLoss: number;
  }>;
}

export async function getDashboardPerformance(): Promise<UserDashboardPerformance> {
  const allSettled: Array<{
    id: string;
    date: string;
    match: string;
    market: 'ASIAN_HANDICAP' | 'OVER_UNDER' | 'BTTS';
    pick: string;
    odds: number;
    result: string;
    profitLoss: number;
  }> = [];

  try {
    const terminalPredictions = await getTerminalPredictions();
    const settledTerminal = terminalPredictions.filter((p) => p.settlement_status === 'SETTLED');

    for (const p of settledTerminal) {
      const pl = p.profit_loss || 0;
      allSettled.push({
        id: p.id,
        date: p.kickoff_at.slice(0, 10),
        match: `${p.home_team} vs ${p.away_team}`,
        market: 'ASIAN_HANDICAP',
        pick: `${p.side.toUpperCase()} ${p.line > 0 ? `+${p.line}` : p.line}`,
        odds: p.taken_odds,
        result: p.actual_outcome || (pl > 0 ? 'WIN' : pl < 0 ? 'LOSS' : 'PUSH'),
        profitLoss: pl,
      });
    }
  } catch (err) {
    console.warn('[DashboardPerformance] Terminal predictions error:', err);
  }

  try {
    const { data: dbSettled, error } = await supabase
      .from('archived_daily_picks')
      .select('*')
      .in('status', ['WON', 'LOST', 'PUSH'])
      .order('settled_at', { ascending: false })
      .limit(100);

    if (!error && dbSettled && dbSettled.length > 0) {
      for (const row of dbSettled) {
        if (allSettled.some((s) => s.id === row.id)) continue;

        const mType = (row.market_type || '').toUpperCase();
        if (mType === 'ASIAN_HANDICAP' || mType === 'OVER_UNDER' || mType === 'BTTS') {
          const pl = row.profit_loss || (row.status === 'WON' ? (row.market_odds || 1.9) - 1 : row.status === 'LOST' ? -1 : 0);
          allSettled.push({
            id: row.id,
            date: (row.settled_at || row.kickoff_utc || row.created_at || '').slice(0, 10),
            match: `${row.home_team} vs ${row.away_team}`,
            market: mType as 'ASIAN_HANDICAP' | 'OVER_UNDER' | 'BTTS',
            pick: row.prediction || mType,
            odds: row.market_odds || 1.9,
            result: row.status,
            profitLoss: pl,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[DashboardPerformance] Supabase daily_picks query error:', err);
  }

  const totalBets = allSettled.length;
  const won = allSettled.filter((s) => s.profitLoss > 0).length;
  const lost = allSettled.filter((s) => s.profitLoss < 0).length;
  const pushes = allSettled.filter((s) => s.profitLoss === 0).length;
  const totalProfit = allSettled.reduce((sum, s) => sum + s.profitLoss, 0);

  const deciderBets = won + lost;
  const winRate = deciderBets > 0 ? Number(((won / deciderBets) * 100).toFixed(1)) : 0;
  const yieldRoi = totalBets > 0 ? Number(((totalProfit / totalBets) * 100).toFixed(2)) : 0;

  const computeMarketStats = (
    marketCode: 'ASIAN_HANDICAP' | 'OVER_UNDER' | 'BTTS',
    displayName: string
  ): MarketPerformance => {
    const marketItems = allSettled.filter((s) => s.market === marketCode);
    const mBets = marketItems.length;
    const mWon = marketItems.filter((s) => s.profitLoss > 0).length;
    const mLost = marketItems.filter((s) => s.profitLoss < 0).length;
    const mPushes = marketItems.filter((s) => s.profitLoss === 0).length;
    const mProfit = marketItems.reduce((sum, s) => sum + s.profitLoss, 0);
    const mDeciders = mWon + mLost;
    const mWinRate = mDeciders > 0 ? Number(((mWon / mDeciders) * 100).toFixed(1)) : 0;
    const mYield = mBets > 0 ? Number(((mProfit / mBets) * 100).toFixed(2)) : 0;

    return {
      market: marketCode,
      name: displayName,
      bets: mBets,
      won: mWon,
      lost: mLost,
      pushes: mPushes,
      winRate: mWinRate,
      yieldPct: mYield,
      totalProfit: Number(mProfit.toFixed(2)),
    };
  };

  return {
    hasData: totalBets > 0,
    totalBets,
    won,
    lost,
    pushes,
    winRate,
    yieldRoi,
    totalProfit: Number(totalProfit.toFixed(2)),
    byMarket: {
      asianHandicap: computeMarketStats('ASIAN_HANDICAP', 'Asian Handicap'),
      overUnder: computeMarketStats('OVER_UNDER', 'Over / Under'),
      btts: computeMarketStats('BTTS', 'Both Teams To Score'),
    },
    recentSettled: allSettled.slice(0, 10),
  };
}

