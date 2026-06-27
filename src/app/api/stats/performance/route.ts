import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase.server';

export async function GET(request?: Request) {
  try {
    let marketParam: string | null = null;
    if (request && request.url) {
      const { searchParams } = new URL(request.url);
      marketParam = searchParams.get('market');
    }

    // 1. Fetch all settled signals from the database
    const { data: signals, error } = await supabase
      .from('signals')
      .select('*, signal_metrics(*)')
      .not('settled_at', 'is', null)
      .order('settled_at', { ascending: false });

    if (error) {
      console.error('[Performance API] Error querying signals:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let filteredSignals = signals || [];
    if (marketParam) {
      filteredSignals = filteredSignals.filter(
        sig => (sig.market || '').toLowerCase() === marketParam.toLowerCase() ||
               (sig.market_category || '').toLowerCase() === marketParam.toLowerCase()
      );
    }

    const settledCount = filteredSignals.length;

    let profitUnits = 0;
    let winCount = 0;
    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let cancelled = 0;
    let binaryBrierSum = 0;
    let binaryCount = 0;
    let clvSum = 0;
    let clvCount = 0;
    let oddsSum = 0;
    let qualitySum = 0;
    let qualityCount = 0;
    const modelBreakdown: Record<string, { sample_size: number; win_rate: number; roi: number; profit_units: number; win_count: number }> = {};

    // Period specific variables
    const now = Date.now();
    const ms30 = 30 * 24 * 60 * 60 * 1000;
    const ms60 = 60 * 24 * 60 * 60 * 1000;
    const ms90 = 90 * 24 * 60 * 60 * 1000;

    let count30 = 0, win30 = 0, profit30 = 0;
    let count60 = 0, win60 = 0, profit60 = 0;
    let count90 = 0, win90 = 0, profit90 = 0;

    // League breakdown
    const leagueBreakdown: Record<string, { sample_size: number; win_rate: number; roi: number; profit_units: number; win_count: number }> = {};

    filteredSignals.forEach((sig) => {
      const odds = Number(sig.odds || 1.0);
      const prob = Number(sig.probability || 0.5);
      const status = (sig.status || 'pending').toLowerCase();
      let profit = 0;
      let outcomeValue = 0;
      let isWin = false;

      if (status === 'won' || status === 'win') {
        profit = odds - 1.0;
        outcomeValue = 1.0;
        isWin = true;
        wins++;
      } else if (status === 'half_win') {
        profit = 0.5 * (odds - 1.0);
        outcomeValue = 1.0;
        isWin = true;
        wins++;
      } else if (status === 'push' || status === 'void') {
        profit = 0.0;
        outcomeValue = 0.5;
        pushes++;
      } else if (status === 'half_loss') {
        profit = -0.5;
        outcomeValue = 0.0;
        losses++;
      } else if (status === 'cancelled') {
        profit = 0.0;
        outcomeValue = 0.5;
        cancelled++;
      } else {
        profit = -1.0;
        outcomeValue = 0.0;
        losses++;
      }

      profitUnits += profit;
      oddsSum += odds;

      // CLV Percentage aggregation
      const clvPercentage = sig.clv_percentage !== null && sig.clv_percentage !== undefined 
        ? Number(sig.clv_percentage) 
        : (sig.clv !== null && sig.clv !== undefined ? Number(sig.clv) * 100 : null);

      if (clvPercentage !== null) {
        clvSum += clvPercentage;
        clvCount++;
      }

      // Brier score only for binary markets (asian_handicap and over_under)
      const market = (sig.market || '').toLowerCase();
      if (market === 'asian_handicap' || market === 'over_under') {
        binaryBrierSum += Math.pow(prob - outcomeValue, 2);
        binaryCount++;
      }

      // Period checks
      if (sig.settled_at) {
        const settledTime = new Date(sig.settled_at).getTime();
        const age = now - settledTime;
        if (age <= ms30) {
          count30++;
          if (isWin) win30++;
          profit30 += profit;
        }
        if (age <= ms60) {
          count60++;
          if (isWin) win60++;
          profit60 += profit;
        }
        if (age <= ms90) {
          count90++;
          if (isWin) win90++;
          profit90 += profit;
        }
      }

      // Quality score aggregation
      const metricsObj = Array.isArray(sig.signal_metrics)
        ? sig.signal_metrics[0]
        : sig.signal_metrics;
      const qualityScore = metricsObj?.quality_score !== null && metricsObj?.quality_score !== undefined
        ? Number(metricsObj.quality_score)
        : null;
      if (qualityScore !== null) {
        qualitySum += qualityScore;
        qualityCount++;
      }

      // Model version breakdown
      const modelVer = sig.model_version || 'rule_v1';
      if (!modelBreakdown[modelVer]) {
        modelBreakdown[modelVer] = { sample_size: 0, win_rate: 0, roi: 0, profit_units: 0, win_count: 0 };
      }
      const modelStats = modelBreakdown[modelVer];
      modelStats.sample_size++;
      modelStats.profit_units += profit;
      if (isWin) {
        modelStats.win_count++;
      }

      // League breakdown
      if (sig.league) {
        const lg = sig.league;
        if (!leagueBreakdown[lg]) {
          leagueBreakdown[lg] = { sample_size: 0, win_rate: 0, roi: 0, profit_units: 0, win_count: 0 };
        }
        const ldata = leagueBreakdown[lg];
        ldata.sample_size++;
        if (isWin) ldata.win_count++;
        ldata.profit_units += profit;
      }
    });

    // Finalize league breakdown
    Object.keys(leagueBreakdown).forEach((lg) => {
      const ldata = leagueBreakdown[lg];
      ldata.roi = ldata.sample_size > 0 ? Number(((ldata.profit_units / ldata.sample_size) * 100).toFixed(2)) : 0;
      ldata.win_rate = ldata.sample_size > 0 ? Number(((ldata.win_count / ldata.sample_size) * 100).toFixed(2)) : 0;
    });

    // Max drawdown calculation using peak equity tracking (baseline 100.0)
    let balance = 100.0;
    let peak = 100.0;
    let maxDrawdown = 0.0;
    const sortedSignals = [...filteredSignals].sort((a, b) => new Date(a.settled_at).getTime() - new Date(b.settled_at).getTime());
    sortedSignals.forEach((sig) => {
      const odds = Number(sig.odds || 1.0);
      const status = (sig.status || 'pending').toLowerCase();
      let profit = 0;
      if (status === 'won' || status === 'win') {
        profit = odds - 1.0;
      } else if (status === 'half_win') {
        profit = 0.5 * (odds - 1.0);
      } else if (status === 'push' || status === 'void') {
        profit = 0.0;
      } else if (status === 'half_loss') {
        profit = -0.5;
      } else {
        profit = -1.0;
      }
      balance += profit;
      if (balance > peak) {
        peak = balance;
      }
      const drawdown = (peak - balance) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    const insufficientSample = settledCount < 50;
    const averageClv = (insufficientSample || clvCount === 0) ? null : Number((clvSum / clvCount).toFixed(2));
    const roi = settledCount > 0 ? (profitUnits / settledCount) * 100 : 0.0;
    const winRate = settledCount > 0 ? (wins / settledCount) * 100 : 0.0;
    const avgOdds = settledCount > 0 ? oddsSum / settledCount : 0.0;

    // Confidence Level classification
    let confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (settledCount >= 30 && settledCount <= 100) {
      confidenceLevel = 'MEDIUM';
    } else if (settledCount > 100) {
      confidenceLevel = 'HIGH';
    }

    // Sub-periods final calculations
    const last_30_days = {
      roi: count30 > 0 ? Number(((profit30 / count30) * 100).toFixed(2)) : 0.0,
      win_rate: count30 > 0 ? Number(((win30 / count30) * 100).toFixed(2)) : 0.0
    };
    const last_60_days = {
      roi: count60 > 0 ? Number(((profit60 / count60) * 100).toFixed(2)) : 0.0,
      win_rate: count60 > 0 ? Number(((win60 / count60) * 100).toFixed(2)) : 0.0
    };
    const last_90_days = {
      roi: count90 > 0 ? Number(((profit90 / count90) * 100).toFixed(2)) : 0.0,
      win_rate: count90 > 0 ? Number(((win90 / count90) * 100).toFixed(2)) : 0.0
    };

    const brierScore = binaryCount > 0 ? (binaryBrierSum / binaryCount) : 0.0;
    const calibrationScore = Math.round((1.0 - brierScore) * 100);

    const { data: latestSig } = await supabase
      .from('signals')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const latestSignalAt = latestSig?.created_at || null;
    const latestSettlementAt = signals && signals.length > 0 ? signals[0].settled_at : null;

    // Finalize model version breakdown
    Object.keys(modelBreakdown).forEach(key => {
      const stats = modelBreakdown[key];
      stats.win_rate = stats.sample_size > 0 ? Number(((stats.win_count / stats.sample_size) * 100).toFixed(2)) : 0.0;
      stats.roi = stats.sample_size > 0 ? Number(((stats.profit_units / stats.sample_size) * 100).toFixed(2)) : 0.0;
      stats.profit_units = Number(stats.profit_units.toFixed(4));
    });

    const avgQuality = qualityCount > 0 ? Number((qualitySum / qualityCount).toFixed(2)) : 75.0;

    const payload = {
      success: true,
      calibrationInProgress: settledCount < 30,
      insufficient_sample: insufficientSample,
      status: insufficientSample ? 'insufficient_sample' : 'sufficient',
      requiredForClv: 50,
      settledCount,
      sample_size: settledCount,
      confidence_level: confidenceLevel,
      generated_at: new Date().toISOString(),
      latest_signal_at: latestSignalAt,
      latest_settlement_at: latestSettlementAt,
      dataset_version: '1.0.0',
      wins,
      losses,
      pushes,
      cancelled,
      'total settled': settledCount,
      ROI: Number(roi.toFixed(2)),
      Yield: Number(roi.toFixed(2)),
      yield: Number(roi.toFixed(2)),
      CLV: averageClv,
      'Average odds': Number(avgOdds.toFixed(4)),
      'Win rate': Number(winRate.toFixed(2)),
      winrate: Number(winRate.toFixed(2)),
      Drawdown: Number(maxDrawdown.toFixed(4)),
      drawdown: Number(maxDrawdown.toFixed(4)),
      Confidence: confidenceLevel,
      'Quality score average': avgQuality,
      'Model version breakdown': modelBreakdown,
      last_30_days,
      last_60_days,
      last_90_days,
      // Original properties for backwards compatibility
      roi: Number(roi.toFixed(2)),
      winRate: Number(winRate.toFixed(2)),
      win_rate: Number(winRate.toFixed(2)),
      average_odds: Number(avgOdds.toFixed(4)),
      average_CLV: averageClv,
      max_drawdown: Number(maxDrawdown.toFixed(4)),
      league_breakdown: leagueBreakdown,
      brierScore: Number(brierScore.toFixed(4)),
      calibrationScore,
      profitUnits: Number(profitUnits.toFixed(4)),
      averageClv,
      signals: filteredSignals || []
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('[Performance API] Fatal Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
