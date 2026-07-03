import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase.server';
import { LEAGUE_REGISTRY } from '../../../../lib/crons/leagueRegistry';

interface CohortStats {
  totalBets: number;
  wins: number;
  profitUnits: number;
  clvSum: number;
  clvCount: number;
  roi: number;
  avgClv: number;
  hitRate: number;
}

interface CalibrationBucket {
  predictions: number;
  wins: number;
  losses: number;
  profitUnits: number;
  brierSum: number;
  roi: number;
  brierScore: number;
}

interface DecayBucket {
  count: number;
  clvSum: number;
  clvCount: number;
  profitUnits: number;
  roi: number;
  avgClv: number;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const selectedCohort = url.searchParams.get('cohort') || 'all';
    const mode = url.searchParams.get('mode') || 'production';

    let allSignals: any[] = [];

    if (mode === 'production') {
      const { data: signals, error } = await supabase
        .from('signals')
        .select('*')
        .not('settled_at', 'is', null);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      allSignals = signals || [];
    } else {
      // High-fidelity simulation dataset for backtest curves visualization
      const markets = ['asian_handicap', 'over_under', 'moneyline'];
      const leagues = ['English Premier League', 'La Liga', 'Serie A'];
      const cohorts = ['elite_europe', 'europe_qualification', 'latin_america'];
      
      for (let i = 0; i < 500; i++) {
        const isWin = i % 100 < 60; // 60% win rate
        const status = isWin ? 'won' : 'lost';
        const odds = 1.95;
        const prob = 0.55;

        allSignals.push({
          id: `sim-sig-${i}`,
          match_id: `sim-match-${i}`,
          league: leagues[i % 3],
          league_cohort: cohorts[i % 3],
          market: markets[i % 3],
          odds: odds,
          probability: prob,
          clv_percentage: 2.45,
          market_truth_score: 90,
          hours_before_kickoff: 12,
          status: status,
          settled_at: new Date(Date.now() - i * 3600000).toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    // Filter to validation_priority A leagues
    const priorityALeagues = new Set(
      LEAGUE_REGISTRY.filter(l => l.validation_priority === 'A').map(l => l.name)
    );
    
    // In simulation mode, we bypass the registry priority filter to ensure sample is populated
    let filteredSignals = mode === 'production' 
      ? allSignals.filter(sig => sig.league && priorityALeagues.has(sig.league))
      : allSignals;

    // Grouping by Cohort
    const cohortMap: Record<string, CohortStats> = {
      elite_europe: { totalBets: 0, wins: 0, profitUnits: 0, clvSum: 0, clvCount: 0, roi: 0, avgClv: 0, hitRate: 0 },
      europe_qualification: { totalBets: 0, wins: 0, profitUnits: 0, clvSum: 0, clvCount: 0, roi: 0, avgClv: 0, hitRate: 0 },
      latin_america: { totalBets: 0, wins: 0, profitUnits: 0, clvSum: 0, clvCount: 0, roi: 0, avgClv: 0, hitRate: 0 },
      asia: { totalBets: 0, wins: 0, profitUnits: 0, clvSum: 0, clvCount: 0, roi: 0, avgClv: 0, hitRate: 0 },
      other: { totalBets: 0, wins: 0, profitUnits: 0, clvSum: 0, clvCount: 0, roi: 0, avgClv: 0, hitRate: 0 }
    };

    // Confidence Calibration Buckets
    const calibrationMap: Record<string, CalibrationBucket> = {
      '0-55%': { predictions: 0, wins: 0, losses: 0, profitUnits: 0, brierSum: 0, roi: 0, brierScore: 0 },
      '55-60%': { predictions: 0, wins: 0, losses: 0, profitUnits: 0, brierSum: 0, roi: 0, brierScore: 0 },
      '60-65%': { predictions: 0, wins: 0, losses: 0, profitUnits: 0, brierSum: 0, roi: 0, brierScore: 0 },
      '65-70%': { predictions: 0, wins: 0, losses: 0, profitUnits: 0, brierSum: 0, roi: 0, brierScore: 0 },
      '70%+': { predictions: 0, wins: 0, losses: 0, profitUnits: 0, brierSum: 0, roi: 0, brierScore: 0 }
    };

    // Edge Decay Buckets
    const decayMap: Record<string, DecayBucket> = {
      '24h+': { count: 0, clvSum: 0, clvCount: 0, profitUnits: 0, roi: 0, avgClv: 0 },
      '12-24h': { count: 0, clvSum: 0, clvCount: 0, profitUnits: 0, roi: 0, avgClv: 0 },
      '6-12h': { count: 0, clvSum: 0, clvCount: 0, profitUnits: 0, roi: 0, avgClv: 0 },
      '1-6h': { count: 0, clvSum: 0, clvCount: 0, profitUnits: 0, roi: 0, avgClv: 0 },
      '<1h': { count: 0, clvSum: 0, clvCount: 0, profitUnits: 0, roi: 0, avgClv: 0 }
    };

    let wins = 0;
    let oddsSum = 0;
    let profitUnits = 0;
    let clvSum = 0;
    let clvCount = 0;
    let beatClosingCount = 0;

    let truthScoreSum = 0;
    let truthScoreCount = 0;

    let ahCount = 0;
    let ouCount = 0;
    let mlCount = 0;

    let latestUpdated = new Date().toISOString();

    filteredSignals.forEach(sig => {
      const cohortKey = (sig.league_cohort || 'other') as keyof typeof cohortMap;
      const cStats = cohortMap[cohortKey] || cohortMap.other;

      const odds = Number(sig.odds || 1.0);
      const status = (sig.status || 'pending').toLowerCase();
      let profit = 0;
      let isWin = false;
      let isLoss = false;
      let outcomeValue = 0.5;

      if (status === 'won' || status === 'win') {
        profit = odds - 1.0;
        wins++;
        isWin = true;
        outcomeValue = 1.0;
      } else if (status === 'half_win') {
        profit = 0.5 * (odds - 1.0);
        wins++;
        isWin = true;
        outcomeValue = 1.0;
      } else if (status === 'push' || status === 'void') {
        profit = 0.0;
      } else if (status === 'half_loss') {
        profit = -0.5;
        isLoss = true;
        outcomeValue = 0.0;
      } else {
        profit = -1.0;
        isLoss = true;
        outcomeValue = 0.0;
      }

      // Add to overall stats
      profitUnits += profit;
      oddsSum += odds;

      // Add to cohort-specific stats
      cStats.totalBets++;
      cStats.profitUnits += profit;
      if (isWin) cStats.wins++;

      // CLV beat
      const clvPct = sig.clv_percentage !== null && sig.clv_percentage !== undefined
        ? Number(sig.clv_percentage)
        : null;
      if (clvPct !== null) {
        clvSum += clvPct;
        clvCount++;
        if (clvPct > 0) {
          beatClosingCount++;
        }

        cStats.clvSum += clvPct;
        cStats.clvCount++;
      }

      // Market Truth Score
      const truthScore = sig.market_truth_score !== null && sig.market_truth_score !== undefined
        ? Number(sig.market_truth_score)
        : null;
      if (truthScore !== null) {
        truthScoreSum += truthScore;
        truthScoreCount++;
      }

      // Calibration Buckets logic
      const prob = Number(sig.probability || 0.5);
      let calibKey = '0-55%';
      if (prob >= 0.70) calibKey = '70%+';
      else if (prob >= 0.65) calibKey = '65-70%';
      else if (prob >= 0.60) calibKey = '60-65%';
      else if (prob >= 0.55) calibKey = '55-60%';

      const calib = calibrationMap[calibKey];
      calib.predictions++;
      calib.profitUnits += profit;
      if (isWin) calib.wins++;
      if (isLoss) calib.losses++;
      calib.brierSum += Math.pow(prob - outcomeValue, 2);

      // Edge Decay Buckets logic (based on hours_before_kickoff)
      const hours = sig.hours_before_kickoff !== null && sig.hours_before_kickoff !== undefined
        ? Number(sig.hours_before_kickoff)
        : null;
      if (hours !== null) {
        let decayKey = '<1h';
        if (hours >= 24) decayKey = '24h+';
        else if (hours >= 12) decayKey = '12-24h';
        else if (hours >= 6) decayKey = '6-12h';
        else if (hours >= 1) decayKey = '1-6h';

        const dec = decayMap[decayKey];
        dec.count++;
        dec.profitUnits += profit;
        if (clvPct !== null) {
          dec.clvSum += clvPct;
          dec.clvCount++;
        }
      }

      // Market type breakdown
      const market = (sig.market || '').toLowerCase();
      if (market === 'asian_handicap') {
        ahCount++;
      } else if (market === 'over_under') {
        ouCount++;
      } else {
        mlCount++;
      }

      if (sig.updated_at) {
        latestUpdated = sig.updated_at;
      }
    });

    // Compute cohort percentages
    Object.keys(cohortMap).forEach(key => {
      const c = cohortMap[key];
      c.roi = c.totalBets > 0 ? Number(((c.profitUnits / c.totalBets) * 100).toFixed(2)) : 0;
      c.avgClv = c.clvCount > 0 ? Number((c.clvSum / c.clvCount).toFixed(2)) : 0;
      c.hitRate = c.totalBets > 0 ? Number(((c.wins / c.totalBets) * 100).toFixed(2)) : 0;
    });

    // Compute calibration percentages
    Object.keys(calibrationMap).forEach(key => {
      const c = calibrationMap[key];
      c.roi = c.predictions > 0 ? Number(((c.profitUnits / c.predictions) * 100).toFixed(2)) : 0;
      c.brierScore = c.predictions > 0 ? Number((c.brierSum / c.predictions).toFixed(4)) : 0;
    });

    // Compute decay percentages
    Object.keys(decayMap).forEach(key => {
      const d = decayMap[key];
      d.roi = d.count > 0 ? Number(((d.profitUnits / d.count) * 100).toFixed(2)) : 0;
      d.avgClv = d.clvCount > 0 ? Number((d.clvSum / d.clvCount).toFixed(2)) : 0;
    });

    // If cohort filter is active, slice filteredSignals for the drawdown/curves calculation
    if (selectedCohort !== 'all') {
      filteredSignals = filteredSignals.filter(sig => sig.league_cohort === selectedCohort);
    }

    const totalBets = filteredSignals.length;
    const insufficientSample = totalBets < 100;

    let periodWins = 0;
    let periodOddsSum = 0;
    let periodProfitUnits = 0;
    let periodClvSum = 0;
    let periodClvCount = 0;
    let periodBeatClosingCount = 0;

    // Equity curve for drawdown calculation
    let balance = 100.0;
    let peak = 100.0;
    let maxDrawdown = 0.0;

    const sortedSignals = [...filteredSignals].sort(
      (a, b) => new Date(a.settled_at).getTime() - new Date(b.settled_at).getTime()
    );

    sortedSignals.forEach(sig => {
      const odds = Number(sig.odds || 1.0);
      const status = (sig.status || 'pending').toLowerCase();
      let profit = 0;

      if (status === 'won' || status === 'win') {
        profit = odds - 1.0;
        periodWins++;
      } else if (status === 'half_win') {
        profit = 0.5 * (odds - 1.0);
        periodWins++;
      } else if (status === 'push' || status === 'void') {
        profit = 0.0;
      } else if (status === 'half_loss') {
        profit = -0.5;
      } else {
        profit = -1.0;
      }

      periodProfitUnits += profit;
      periodOddsSum += odds;

      balance += profit;
      if (balance > peak) {
        peak = balance;
      }
      const dd = peak > 0 ? (peak - balance) / peak : 0;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }

      const clvPct = sig.clv_percentage !== null && sig.clv_percentage !== undefined
        ? Number(sig.clv_percentage)
        : null;
      if (clvPct !== null) {
        periodClvSum += clvPct;
        periodClvCount++;
        if (clvPct > 0) {
          periodBeatClosingCount++;
        }
      }
    });

    const roi = totalBets > 0 ? (periodProfitUnits / totalBets) * 100 : 0.0;
    const hitRate = totalBets > 0 ? (periodWins / totalBets) * 100 : 0.0;
    const avgOdds = totalBets > 0 ? periodOddsSum / totalBets : 0.0;
    const avgClv = periodClvCount > 0 ? periodClvSum / periodClvCount : 0.0;
    const beatClosingRate = periodClvCount > 0 ? (periodBeatClosingCount / periodClvCount) * 100 : 0.0;
    const avgTruthScore = truthScoreCount > 0 ? truthScoreSum / truthScoreCount : 90.0;

    // Statistical Confidence Score calculation
    const sampleSizeWeight = Math.min(1.0, totalBets / 500) * 40;
    const clvConsistencyWeight = Math.min(1.0, beatClosingRate / 60) * 30;
    const drawdownPercent = maxDrawdown * 100;
    const roiStabilityWeight = Math.max(0, 1.0 - (drawdownPercent / 100)) * 30;
    const sampleConfidenceScore = Number((sampleSizeWeight + clvConsistencyWeight + roiStabilityWeight).toFixed(1));

    let sampleConfidenceCategory = 'insufficient data';
    if (sampleConfidenceScore >= 85) sampleConfidenceCategory = 'validated';
    else if (sampleConfidenceScore >= 70) sampleConfidenceCategory = 'strong';
    else if (sampleConfidenceScore >= 40) sampleConfidenceCategory = 'developing';

    return NextResponse.json({
      success: true,
      totalBets,
      insufficientSample,
      roi: Number(roi.toFixed(2)),
      yield: Number(roi.toFixed(2)),
      hitRate: Number(hitRate.toFixed(2)),
      avgOdds: Number(avgOdds.toFixed(2)),
      avgClv: Number(avgClv.toFixed(2)),
      beatClosingRate: Number(beatClosingRate.toFixed(2)),
      maxDrawdown: Number((maxDrawdown * 100).toFixed(2)),
      sample_confidence_score: sampleConfidenceScore,
      sample_confidence_category: sampleConfidenceCategory,
      cohortBreakdown: cohortMap,
      calibrationMap,
      decayMap,
      validationProgress: {
        settledCount: allSignals.length,
        ahCount,
        ouCount,
        mlCount,
        targetSufficient: allSignals.length >= 100 &&
          ahCount >= 40 &&
          ouCount >= 30 &&
          mlCount >= 30 &&
          cohortMap.elite_europe.totalBets >= 20 &&
          cohortMap.europe_qualification.totalBets >= 20 &&
          cohortMap.latin_america.totalBets >= 20 &&
          cohortMap.asia.totalBets >= 20,
        averageClv: Number((clvSum / (clvCount || 1)).toFixed(2)),
        averageMarketTruthScore: Number(avgTruthScore.toFixed(1)),
        lastUpdated: latestUpdated
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
