import React from 'react';

// We'll simulate fetching data from our backtest evaluation engine or static JSON files.
// For now, we present a mock/static shell based on the required dashboard structure.
import { ProbabilityCharts } from '../../../components/research/ProbabilityCharts';

export default function ProbabilityDashboard() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 bg-slate-900 text-slate-100 min-h-screen">
      <header className="border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-bold text-emerald-400">HandicapLab Dashboard</h1>
        <h2 className="text-xl text-slate-400">Probability Lab</h2>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Dataset Overview */}
        <section className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Dataset Overview</h3>
          <div className="space-y-2">
            <div className="flex justify-between border-b border-slate-700 pb-2">
              <span className="text-slate-400">League</span>
              <span className="font-medium">EPL</span>
            </div>
            <div className="flex justify-between border-b border-slate-700 pb-2">
              <span className="text-slate-400">Seasons</span>
              <span className="font-medium">2015-2026</span>
            </div>
            <div className="flex justify-between border-b border-slate-700 pb-2">
              <span className="text-slate-400">Matches</span>
              <span className="font-medium">4,180</span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-slate-400">Models Evaluated</span>
              <span className="font-medium">Poisson, Dixon-Coles</span>
            </div>
          </div>
        </section>

        {/* Model Comparison */}
        <section className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Model Comparison</h3>
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="pb-2">Model</th>
                <th className="pb-2">Brier</th>
                <th className="pb-2">Log Loss</th>
                <th className="pb-2">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-700/50">
                <td className="py-2 text-emerald-400 font-medium">Poisson xG</td>
                <td className="py-2">0.185</td>
                <td className="py-2">0.965</td>
                <td className="py-2">55.2%</td>
              </tr>
              <tr>
                <td className="py-2 text-blue-400 font-medium">Dixon-Coles</td>
                <td className="py-2">0.181</td>
                <td className="py-2">0.952</td>
                <td className="py-2">56.1%</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Season Performance & Calibration Chart (Mocked visual) */}
        <section className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Calibration & Performance</h3>
          <ProbabilityCharts />
        </section>

        {/* Latest Predictions */}
        <section className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Latest Predictions (EPL 2025-2026)</h3>
          
          <div className="space-y-4">
            <div className="bg-slate-900 p-4 rounded border border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-lg">Arsenal vs Chelsea</span>
                <span className="px-2 py-1 bg-emerald-900 text-emerald-300 text-xs rounded">Poisson xG</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-800 p-2 rounded">
                  <div className="text-sm text-slate-400 mb-1">Home Win</div>
                  <div className="text-xl font-bold text-emerald-400">52%</div>
                </div>
                <div className="bg-slate-800 p-2 rounded">
                  <div className="text-sm text-slate-400 mb-1">Draw</div>
                  <div className="text-xl font-bold text-slate-300">25%</div>
                </div>
                <div className="bg-slate-800 p-2 rounded">
                  <div className="text-sm text-slate-400 mb-1">Away Win</div>
                  <div className="text-xl font-bold text-blue-400">23%</div>
                </div>
              </div>

              <div className="mt-4 text-sm text-slate-400 flex justify-between border-t border-slate-800 pt-2">
                <div>Model Confidence: <span className="text-white">High</span></div>
                <div>Actual Result: <span className="text-emerald-400">Win (Correct)</span></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
