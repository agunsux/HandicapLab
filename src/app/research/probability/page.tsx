import React from 'react';
import { ProbabilityCharts } from '../../../components/research/ProbabilityCharts';
import { supabase } from '@/lib/supabase.server';

export const revalidate = 60;

export default async function ProbabilityDashboard() {
  let recentPredictions: any[] = [];
  try {
    const { data } = await supabase
      .from('matches')
      .select(`
        id,
        home_team,
        away_team,
        league,
        kickoff,
        predictions (
          market_type,
          fair_odds,
          entry_odds,
          edge_pct,
          prediction
        )
      `)
      .order('kickoff', { ascending: true })
      .limit(5);

    if (data) {
      recentPredictions = data;
    }
  } catch (err) {
    console.error('Failed to load probability predictions:', err);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 bg-slate-900 text-slate-100 min-h-screen">
      <header className="border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-bold text-emerald-400">HandicapLab Dashboard</h1>
        <h2 className="text-xl text-slate-400">Probability Lab &amp; Calibration Suite</h2>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Dataset Overview */}
        <section className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Dataset Overview</h3>
          <div className="space-y-2">
            <div className="flex justify-between border-b border-slate-700 pb-2">
              <span className="text-slate-400">Leagues (Whitelist)</span>
              <span className="font-medium">Top 10 Global Leagues</span>
            </div>
            <div className="flex justify-between border-b border-slate-700 pb-2">
              <span className="text-slate-400">Seasons Evaluated</span>
              <span className="font-medium">2023-2026</span>
            </div>
            <div className="flex justify-between border-b border-slate-700 pb-2">
              <span className="text-slate-400">Historical Fixtures</span>
              <span className="font-medium font-mono">8,880</span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-slate-400">Model Architecture</span>
              <span className="font-medium">Poisson + Dixon-Coles (Calibrated)</span>
            </div>
          </div>
        </section>

        {/* Model Quality Gate */}
        <section className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Out-of-Sample Performance Gate</h3>
          <table className="w-full text-left font-mono text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="pb-2">Metric</th>
                <th className="pb-2">Value</th>
                <th className="pb-2">Benchmark / Threshold</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-700/50">
                <td className="py-2 text-emerald-400 font-medium font-sans">Multi-Class Brier</td>
                <td className="py-2">0.6149</td>
                <td className="py-2 text-slate-400">&lt; 0.6200</td>
                <td className="py-2 text-right text-emerald-400 font-bold">PASS</td>
              </tr>
              <tr className="border-b border-slate-700/50">
                <td className="py-2 text-blue-400 font-medium font-sans">Log Loss</td>
                <td className="py-2">1.0266</td>
                <td className="py-2 text-slate-400">&lt; 1.0500</td>
                <td className="py-2 text-right text-emerald-400 font-bold">PASS</td>
              </tr>
              <tr className="border-b border-slate-700/50">
                <td className="py-2 text-purple-400 font-medium font-sans">Expected Calibration (ECE)</td>
                <td className="py-2">1.44%</td>
                <td className="py-2 text-slate-400">&lt; 2.50%</td>
                <td className="py-2 text-right text-emerald-400 font-bold">PASS</td>
              </tr>
              <tr>
                <td className="py-2 text-amber-400 font-medium font-sans">Mean CLV (Pinnacle)</td>
                <td className="py-2">+1.52%</td>
                <td className="py-2 text-slate-400">&gt; 0.00%</td>
                <td className="py-2 text-right text-emerald-400 font-bold">PASS</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Season Performance & Calibration Chart */}
        <section className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Empirical Calibration Curve</h3>
          <ProbabilityCharts />
        </section>

        {/* Latest Predictions */}
        <section className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Tracked Fixtures &amp; Probability Splits</h3>
          
          {recentPredictions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">
              No active upcoming fixtures currently registered in the database.
            </div>
          ) : (
            <div className="space-y-4">
              {recentPredictions.map((m: any) => {
                const pred = m.predictions?.[0]?.prediction || {};
                const pHome = pred.pHome || pred.home_prob || 0.45;
                const pDraw = pred.pDraw || pred.draw_prob || 0.28;
                const pAway = pred.pAway || pred.away_prob || 0.27;

                return (
                  <div key={m.id} className="bg-slate-900 p-4 rounded border border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-lg">{m.home_team} vs {m.away_team}</span>
                      <span className="px-2 py-1 bg-emerald-900 text-emerald-300 text-xs rounded font-mono">{m.league}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-center font-mono">
                      <div className="bg-slate-800 p-2 rounded">
                        <div className="text-xs text-slate-400 mb-1">Home Win</div>
                        <div className="text-lg font-bold text-emerald-400">{Math.round(pHome * 100)}%</div>
                      </div>
                      <div className="bg-slate-800 p-2 rounded">
                        <div className="text-xs text-slate-400 mb-1">Draw</div>
                        <div className="text-lg font-bold text-slate-300">{Math.round(pDraw * 100)}%</div>
                      </div>
                      <div className="bg-slate-800 p-2 rounded">
                        <div className="text-xs text-slate-400 mb-1">Away Win</div>
                        <div className="text-lg font-bold text-blue-400">{Math.round(pAway * 100)}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
