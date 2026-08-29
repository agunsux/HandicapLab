import React from 'react';
import { getTerminalPredictions } from '@/lib/terminalData';
import { ResearchBanner } from '@/components/terminal/ResearchBanner';
import { AhValueEngine } from '@/lib/research/ah-solo/ahValueEngine';
import { BarChart3, TrendingUp, ShieldCheck, Target, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Track Record & Out-of-Sample Validation — HandicapLab',
  description: 'Audited performance track record with Closing Line Value (CLV), bootstrap confidence intervals, and research status.',
};

export default async function TrackRecordPage() {
  const predictions = await getTerminalPredictions();
  const settled = predictions.filter((p) => p.settlement_status === 'SETTLED');

  const targetGate = 175;
  const gateProgress = Number(((settled.length / targetGate) * 100).toFixed(1));

  // Sort settled chronologically
  const sortedSettled = [...settled].sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
  );

  // Compute cumulative P/L
  let runningProfit = 0;
  const plSeries = sortedSettled.map((p, idx) => {
    runningProfit += p.profit_loss || 0;
    return {
      index: idx + 1,
      profit: Number(runningProfit.toFixed(2)),
      match: `${p.home_team} vs ${p.away_team}`,
      date: p.kickoff_at.slice(0, 10),
    };
  });

  const wins = settled.filter((p) => (p.profit_loss || 0) > 0).length;
  const hitRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;

  // Realized ROI
  const totalProfit = settled.reduce((sum, p) => sum + (p.profit_loss || 0), 0);
  const realizedRoi = settled.length > 0 ? (totalProfit / settled.length) * 100 : 0;

  // Bootstrap CI
  const unitReturns = settled.map((p) => p.profit_loss || 0);
  const [roiCiLow, roiCiHigh] =
    unitReturns.length > 0
      ? AhValueEngine.computeBootstrapCi(unitReturns)
      : [0, 0];

  // CLV Stats
  const clvValues = settled
    .map((p) => p.clv)
    .filter((c): c is number => c !== undefined && c !== null && !isNaN(c));
  const clvMean =
    clvValues.length > 0
      ? clvValues.reduce((a, b) => a + b, 0) / clvValues.length
      : 0;

  const clvVar =
    clvValues.length > 1
      ? clvValues.reduce((s, x) => s + Math.pow(x - clvMean, 2), 0) / (clvValues.length - 1)
      : 0;
  const clvSe = Math.sqrt(clvVar / Math.max(1, clvValues.length));
  const clvZ = clvSe > 0 ? clvMean / clvSe : 0;

  // Monthly breakdown
  const monthlyMap = new Map<string, { total: number; profit: number; wins: number; clvSum: number; clvCount: number }>();
  for (const s of sortedSettled) {
    const month = s.kickoff_at.slice(0, 7);
    const curr = monthlyMap.get(month) || { total: 0, profit: 0, wins: 0, clvSum: 0, clvCount: 0 };
    curr.total += 1;
    curr.profit += s.profit_loss || 0;
    if ((s.profit_loss || 0) > 0) curr.wins += 1;
    if (s.clv !== undefined && s.clv !== null) {
      curr.clvSum += s.clv;
      curr.clvCount += 1;
    }
    monthlyMap.set(month, curr);
  }

  const monthlyBreakdown = Array.from(monthlyMap.entries()).map(([month, data]) => ({
    month,
    total: data.total,
    roi: (data.profit / data.total) * 100,
    hitRate: (data.wins / data.total) * 100,
    clvMean: data.clvCount > 0 ? data.clvSum / data.clvCount : 0,
  }));

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E] font-sans text-[#F0FDF4]">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-8 pb-16 flex-1">
        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-amber-400 mb-2">
            <BarChart3 className="h-3.5 w-3.5" />
            LIVE VALIDATION &amp; TRACK RECORD
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">
            Empirical Track Record
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1 max-w-2xl">
            Live out-of-sample execution audit. Every signal evaluated at market taken price against Pinnacle closing ground truth.
          </p>
        </div>

        {/* HONESTY BANNER */}
        <ResearchBanner />

        {/* VALIDATION GATE PROGRESS */}
        <div className="bg-[#111827]/80 border border-[#1F2937] rounded-xl p-6 my-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
            <div>
              <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                Validation Gate Status (Sprint 59)
              </span>
              <h2 className="text-lg font-bold text-white">
                {settled.length} / {targetGate} Settled Out-of-Sample Signals
              </h2>
            </div>
            <span className="text-xs font-mono text-[#9CA3AF]">
              Progress: <strong className="text-white">{gateProgress}%</strong>
            </span>
          </div>

          <div className="w-full bg-[#0B0F0E] h-2.5 rounded-full overflow-hidden border border-[#1F2937]">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, gateProgress)}%` }}
            />
          </div>

          <p className="text-xs text-[#9CA3AF] mt-3 leading-relaxed">
            The platform requires a minimum sample of 150-200 settled out-of-sample predictions before model validity can be certified. Currently in <strong>RESEARCH_ONLY</strong> phase.
          </p>
        </div>

        {/* HERO METRICS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6 font-mono">
          <div className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-4">
            <span className="text-[10px] text-[#9CA3AF] uppercase block">Realized Live ROI</span>
            <div className={`text-2xl font-bold mt-1 ${realizedRoi >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>
              {realizedRoi >= 0 ? `+${realizedRoi.toFixed(2)}%` : `${realizedRoi.toFixed(2)}%`}
            </div>
            <span className="text-[10px] text-[#9CA3AF] block mt-1">95% CI: [{roiCiLow.toFixed(1)}%, {roiCiHigh.toFixed(1)}%]</span>
          </div>

          <div className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-4">
            <span className="text-[10px] text-[#9CA3AF] uppercase block">Mean Live CLV</span>
            <div className={`text-2xl font-bold mt-1 ${clvMean >= 0 ? 'text-[#10B981]' : 'text-neutral-400'}`}>
              {clvMean >= 0 ? `+${clvMean.toFixed(2)}%` : `${clvMean.toFixed(2)}%`}
            </div>
            <span className="text-[10px] text-[#9CA3AF] block mt-1">Z-Score: {clvZ.toFixed(2)}</span>
          </div>

          <div className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-4">
            <span className="text-[10px] text-[#9CA3AF] uppercase block">Live Hit Rate</span>
            <div className="text-2xl font-bold text-white mt-1">
              {hitRate.toFixed(1)}%
            </div>
            <span className="text-[10px] text-[#9CA3AF] block mt-1">{wins} wins / {settled.length} settled</span>
          </div>

          <div className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-4">
            <span className="text-[10px] text-[#9CA3AF] uppercase block">Historical Backtest ROI</span>
            <div className="text-2xl font-bold text-red-400 mt-1">
              -2.30%
            </div>
            <span className="text-[10px] text-[#9CA3AF] block mt-1">7,225 bets (p=0.555)</span>
          </div>
        </div>

        {/* CUMULATIVE P/L CURVE */}
        <div className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-6 my-6">
          <h3 className="text-base font-bold text-white mb-1">Live Cumulative Profit Curve</h3>
          <p className="text-xs text-[#9CA3AF] mb-6">Unit return progression over sequence of settled predictions.</p>

          {plSeries.length === 0 ? (
            <div className="h-48 flex items-center justify-center border border-dashed border-[#1F2937] rounded-lg text-xs text-[#9CA3AF]">
              Awaiting settled signals to render cumulative curve...
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-48 w-full flex items-end gap-1 px-2 border-b border-[#1F2937]">
                {plSeries.map((pt, i) => {
                  const min = Math.min(...plSeries.map((p) => p.profit), 0);
                  const max = Math.max(...plSeries.map((p) => p.profit), 1);
                  const range = max - min || 1;
                  const normalizedHeight = Math.max(8, ((pt.profit - min) / range) * 160);

                  return (
                    <div
                      key={i}
                      title={`${pt.date}: ${pt.match} -> ${pt.profit}u`}
                      className="flex-1 bg-amber-400/80 hover:bg-amber-300 rounded-t transition-all cursor-pointer"
                      style={{ height: `${normalizedHeight}px` }}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#9CA3AF]">
                <span>Start</span>
                <span>Latest ({settled.length} bets, Net: {totalProfit.toFixed(2)}u)</span>
              </div>
            </div>
          )}
        </div>

        {/* MONTHLY BREAKDOWN TABLE */}
        <div className="bg-[#111827]/60 border border-[#1F2937] rounded-xl p-6 my-6">
          <h3 className="text-base font-bold text-white mb-4">Monthly Cohort Breakdown</h3>

          {monthlyBreakdown.length === 0 ? (
            <div className="text-xs text-[#9CA3AF] py-6 text-center">
              No monthly cohort settlements recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead>
                  <tr className="border-b border-[#1F2937] text-[#9CA3AF]">
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3">Signals</th>
                    <th className="py-2.5 px-3">Hit Rate</th>
                    <th className="py-2.5 px-3">Mean CLV</th>
                    <th className="py-2.5 px-3">Realized ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                  {monthlyBreakdown.map((row) => (
                    <tr key={row.month} className="hover:bg-[#111827]/80">
                      <td className="py-2.5 px-3 font-bold text-white">{row.month}</td>
                      <td className="py-2.5 px-3 text-neutral-300">{row.total}</td>
                      <td className="py-2.5 px-3 text-neutral-300">{row.hitRate.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-neutral-300">
                        {row.clvMean >= 0 ? `+${row.clvMean.toFixed(2)}%` : `${row.clvMean.toFixed(2)}%`}
                      </td>
                      <td className={`py-2.5 px-3 font-bold ${row.roi >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>
                        {row.roi >= 0 ? `+${row.roi.toFixed(2)}%` : `${row.roi.toFixed(2)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
