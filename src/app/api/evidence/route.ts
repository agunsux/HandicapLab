// HandicapLab API - Scientific Evidence Center Endpoint
// Location: src/app/api/evidence/route.ts
//
// REAL DATA ONLY: every metric is computed from prediction_audits rows.
// Metrics that cannot be computed from the available sample are returned as
// null (and rendered as "—" / "PENDING" by the UI). No hardcoded Brier, ECE,
// calibration rate, confidence interval or drawdown is served.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { deriveDataState, type DataState } from '@/lib/data/dataState';

const MIN_SAMPLE = 30;
const WIN_SETTLEMENTS = new Set(['WIN', 'WON', 'HALF_WIN']);
const LOSS_SETTLEMENTS = new Set(['LOSS', 'LOST', 'HALF_LOSS']);
const BINARY_SETTLEMENTS = new Set([...WIN_SETTLEMENTS, ...LOSS_SETTLEMENTS]);

function isNum(value: unknown): value is number {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

export async function GET() {
  try {
    const { data: audits, error } = await supabase
      .from('prediction_audits')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Evidence API] Error fetching prediction audits:', error.message);
    }

    const records = audits || [];
    const totalPredictions = records.length;
    const settledRecords = records.filter((r) => r.settlement && r.settlement !== 'PENDING');

    const profitRecords = settledRecords.filter((r) => isNum(r.profit));
    const totalProfit = profitRecords.reduce((acc, r) => acc + Number(r.profit), 0);
    const paperRoiPct =
      profitRecords.length > 0
        ? Number(((totalProfit / profitRecords.length) * 100).toFixed(2))
        : null;

    const clvRecords = settledRecords.filter((r) => isNum(r.clv));
    const meanClvPct =
      clvRecords.length > 0
        ? Number(
            (
              clvRecords.reduce((acc, r) => acc + Number(r.clv), 0) / clvRecords.length
            ).toFixed(2)
          )
        : null;

    // ── Calibration (real reliability buckets, minimum sample enforced) ──
    const brierRecords = settledRecords.filter(
      (r) => isNum(r.model_prob) && BINARY_SETTLEMENTS.has(String(r.settlement))
    );

    let brierScore: number | null = null;
    let ece: number | null = null;
    let calibrationScorePct: number | null = null;
    const calibrationCurve: Array<{ bucket: string; predicted: number; observed: number; count: number }> = [];

    if (brierRecords.length >= MIN_SAMPLE) {
      brierScore = Number(
        (
          brierRecords.reduce((acc, r) => {
            const y = WIN_SETTLEMENTS.has(String(r.settlement)) ? 1 : 0;
            return acc + Math.pow(Number(r.model_prob) - y, 2);
          }, 0) / brierRecords.length
        ).toFixed(4)
      );

      const buckets = Array.from({ length: 10 }, (_, i) => ({
        low: i / 10,
        high: (i + 1) / 10,
        count: 0,
        probSum: 0,
        wins: 0,
      }));

      for (const r of brierRecords) {
        const p = Number(r.model_prob);
        if (p < 0 || p > 1) continue;
        const idx = Math.min(9, Math.floor(p * 10));
        buckets[idx].count += 1;
        buckets[idx].probSum += p;
        if (WIN_SETTLEMENTS.has(String(r.settlement))) buckets[idx].wins += 1;
      }

      let weightedError = 0;
      let total = 0;
      for (const b of buckets) {
        if (b.count === 0) continue;
        const predicted = b.probSum / b.count;
        const observed = b.wins / b.count;
        calibrationCurve.push({
          bucket: `${Math.round(b.low * 100)}-${Math.round(b.high * 100)}%`,
          predicted: Number((predicted * 100).toFixed(1)),
          observed: Number((observed * 100).toFixed(1)),
          count: b.count,
        });
        weightedError += Math.abs(observed - predicted) * b.count;
        total += b.count;
      }

      if (total > 0) {
        ece = Number((weightedError / total).toFixed(4));
        calibrationScorePct = Number(((1 - ece) * 100).toFixed(1));
      }
    }

    // ── ROI confidence interval (normal approximation, real per-bet returns) ──
    let ci95LowerPct: number | null = null;
    let ci95UpperPct: number | null = null;
    if (profitRecords.length >= MIN_SAMPLE) {
      const returns = profitRecords.map((r) => Number(r.profit));
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance =
        returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (returns.length - 1);
      const se = Math.sqrt(variance / returns.length);
      ci95LowerPct = Number(((mean - 1.96 * se) * 100).toFixed(2));
      ci95UpperPct = Number(((mean + 1.96 * se) * 100).toFixed(2));
    }

    // ── Max drawdown (units, chronological) ──
    let maxDrawdownPct: number | null = null;
    if (profitRecords.length >= MIN_SAMPLE) {
      const chronological = [...profitRecords].sort((a, b) =>
        String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
      );
      let cumulative = 0;
      let peak = 0;
      let maxDrop = 0;
      for (const r of chronological) {
        cumulative += Number(r.profit);
        peak = Math.max(peak, cumulative);
        maxDrop = Math.max(maxDrop, peak - cumulative);
      }
      maxDrawdownPct = Number(maxDrop.toFixed(2)); // units lost from peak
    }

    // ── Subgroup breakdowns (only real fields) ──
    const buildMap = (keyField: string) => {
      const map: Record<string, { bets: number; wins: number; profit: number; clvSum: number; clvCount: number }> = {};
      settledRecords.forEach((r) => {
        const key = String(r[keyField] ?? 'Unknown');
        if (!map[key]) map[key] = { bets: 0, wins: 0, profit: 0, clvSum: 0, clvCount: 0 };
        map[key].bets++;
        if (WIN_SETTLEMENTS.has(String(r.settlement))) map[key].wins++;
        if (isNum(r.profit)) map[key].profit += Number(r.profit);
        if (isNum(r.clv)) {
          map[key].clvSum += Number(r.clv);
          map[key].clvCount++;
        }
      });
      return Object.entries(map).map(([name, stat]) => ({
        name,
        bets: stat.bets,
        winRatePct: stat.bets > 0 ? Number(((stat.wins / stat.bets) * 100).toFixed(1)) : null,
        roiPct: stat.bets > 0 ? Number(((stat.profit / stat.bets) * 100).toFixed(2)) : null,
        clvPct: stat.clvCount > 0 ? Number((stat.clvSum / stat.clvCount).toFixed(2)) : null,
      }));
    };

    const leaguesBreakdown = buildMap('league');
    const marketsBreakdown = buildMap('market');
    const bookmakersBreakdown = buildMap('bookmaker');

    const auditLedgerLogs = records.slice(0, 50).map((r) => ({
      id: r.id,
      fixture: r.fixture_name || (r.fixture_id ? `Fixture ${r.fixture_id}` : `Record ${r.id}`),
      kickoff: r.created_at || null,
      market: r.market || null,
      prob: isNum(r.model_prob) ? Number(r.model_prob) : null,
      fairOdds: isNum(r.fair_odds) ? Number(r.fair_odds) : null,
      bookOdds: isNum(r.odds_at_prediction) ? Number(r.odds_at_prediction) : null,
      status: r.settlement || 'PENDING',
      roi: isNum(r.roi) ? Number(r.roi) : null,
      clv: isNum(r.clv) ? Number(r.clv) : null,
    }));

    const dataState: DataState = deriveDataState({
      hasData: settledRecords.length > 0,
      sampleSize: profitRecords.length,
      minSample: MIN_SAMPLE,
    });

    const evidenceData = {
      systemInfo: {
        classification: 'Scientific Quantitative Platform',
        syncStatus: 'Audited Real-Time Production Ledger',
        lastUpdated: new Date().toISOString(),
        schemaVersion: 'evidence-v2.1-real-only',
      },
      dataState,
      minSample: MIN_SAMPLE,
      heroMetrics: {
        totalPredictions,
        settledPredictions: settledRecords.length,
        paperRoiPct,
        meanClvPct,
        brierScore,
        ece,
        calibrationScorePct,
        ci95LowerPct,
        ci95UpperPct,
        maxDrawdownPct,
        unitsWon: profitRecords.length > 0 ? Number(totalProfit.toFixed(2)) : null,
        historicalSeasonsCount: null,
      },
      calibrationCurve,
      subgroupBreakdown: {
        leagues: leaguesBreakdown,
        markets: marketsBreakdown,
        bookmakers: bookmakersBreakdown,
        oddsRanges: [],
        confidenceBuckets: [],
      },
      auditLedgerLogs,
    };

    return NextResponse.json(evidenceData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch evidence data' }, { status: 500 });
  }
}
