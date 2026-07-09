'use client';

// Shadow Monitoring Dashboard — Realtime Metrics View
import { useEffect, useState } from 'react';

interface ShadowStatus {
  totalPredictions: number;
  settledPredictions: number;
  unsettled: number;
  chainValid: boolean;
  lastEntry: any;
}

interface MarketBreakdown {
  marketType: string;
  totalBets: number;
  wins: number;
  losses: number;
  pushes: number;
  roi: number;
  avgCLV: number;
  avgEdge: number;
}

interface EvaluationWindow {
  window: string;
  settledPredictions: number;
  metrics: { roi: number; avgCLV: number; ece: number; brierScore: number; logLoss: number; totalBets: number; winRate: number };
  risk: { sharpeRatio: number; sortinoRatio: number; maxDrawdown: number };
  bootstrap: { roiCI: [number, number]; roiLower: number };
  marketBreakdown: MarketBreakdown[];
  meetsMinimum: boolean;
}

export default function ShadowDashboard() {
  const [status, setStatus] = useState<ShadowStatus | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationWindow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [evidenceRes, evalRes] = await Promise.all([
          fetch('/api/shadow/evidence'),
          fetch('/api/shadow/evaluate'),
        ]);
        const evidenceData = await evidenceRes.json();
        const evalData = await evalRes.json();
        setStatus(evidenceData);
        setEvaluations(evalData.windows ?? []);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-8"><h1 className="text-2xl font-bold">Shadow Pipeline</h1><p>Loading...</p></div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Shadow Pipeline Monitor</h1>

      {/* Data Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Data Collection</h2>
        <div className="grid grid-cols-4 gap-4">
          <MetricCard title="Total Predictions" value={status?.totalPredictions ?? 0} />
          <MetricCard title="Settled" value={status?.settledPredictions ?? 0} />
          <MetricCard title="Unsettled" value={status?.unsettled ?? 0} />
          <MetricCard title="Chain Valid" value={status?.chainValid ? '✅' : '❌'} />
        </div>
      </section>

      {/* Model Performance Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Model Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Window</th>
                <th className="border p-2">Bets</th>
                <th className="border p-2">ROI</th>
                <th className="border p-2">CLV</th>
                <th className="border p-2">ECE</th>
                <th className="border p-2">Sharpe</th>
                <th className="border p-2">Sortino</th>
                <th className="border p-2">Max DD</th>
                <th className="border p-2">Bootstrap CI</th>
                <th className="border p-2">Ready</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((ev) => (
                <tr key={ev.window}>
                  <td className="border p-2 font-medium">{ev.window}</td>
                  <td className="border p-2">{ev.settledPredictions}</td>
                  <td className={`border p-2 ${ev.metrics.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(ev.metrics.roi * 100).toFixed(2)}%
                  </td>
                  <td className={`border p-2 ${ev.metrics.avgCLV > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(ev.metrics.avgCLV * 100).toFixed(2)}%
                  </td>
                  <td className={`border p-2 ${ev.metrics.ece < 0.05 ? 'text-green-600' : 'text-red-600'}`}>
                    {(ev.metrics.ece * 100).toFixed(2)}%
                  </td>
                  <td className="border p-2">{ev.risk.sharpeRatio.toFixed(2)}</td>
                  <td className="border p-2">{ev.risk.sortinoRatio.toFixed(2)}</td>
                  <td className="border p-2">{(ev.risk.maxDrawdown * 100).toFixed(1)}%</td>
                  <td className="border p-2">
                    [{(ev.bootstrap.roiCI[0] * 100).toFixed(1)}, {(ev.bootstrap.roiCI[1] * 100).toFixed(1)}]
                  </td>
                  <td className="border p-2 text-center">{ev.meetsMinimum ? '✅' : '❌'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Calibration Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Calibration</h2>
        <div className="grid grid-cols-4 gap-4">
          <MetricCard title="ECE (30d)" value={evaluations[0] ? `${(evaluations[0].metrics.ece * 100).toFixed(2)}%` : 'N/A'} />
          <MetricCard title="ECE (90d)" value={evaluations[1] ? `${(evaluations[1].metrics.ece * 100).toFixed(2)}%` : 'N/A'} />
          <MetricCard title="Brier (90d)" value={evaluations[1] ? evaluations[1].metrics.brierScore.toFixed(4) : 'N/A'} />
          <MetricCard title="Win Rate (90d)" value={evaluations[1] ? `${(evaluations[1].metrics.winRate * 100).toFixed(1)}%` : 'N/A'} />
        </div>
        {evaluations.map(ev => (
          <div key={`cal-${ev.window}`} className="mt-2">
            <span className="text-sm font-medium">{ev.window}: </span>
            <span className={`text-sm ${ev.metrics.ece < 0.05 ? 'text-green-600' : 'text-red-600'}`}>
              ECE {(ev.metrics.ece * 100).toFixed(2)}% {ev.metrics.ece < 0.05 ? '✅' : '❌'}
            </span>
          </div>
        ))}
      </section>

      {/* Market Breakdown Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Market Breakdown</h2>
        {evaluations.length > 0 && evaluations[0].marketBreakdown && evaluations[0].marketBreakdown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">Market</th>
                  <th className="border p-2">Bets</th>
                  <th className="border p-2">Wins</th>
                  <th className="border p-2">Losses</th>
                  <th className="border p-2">Pushes</th>
                  <th className="border p-2">ROI</th>
                  <th className="border p-2">CLV</th>
                  <th className="border p-2">Edge</th>
                </tr>
              </thead>
              <tbody>
                {evaluations[0].marketBreakdown.map((mb: MarketBreakdown) => (
                  <tr key={mb.marketType}>
                    <td className="border p-2 font-medium">{mb.marketType}</td>
                    <td className="border p-2">{mb.totalBets}</td>
                    <td className="border p-2">{mb.wins}</td>
                    <td className="border p-2">{mb.losses}</td>
                    <td className="border p-2">{mb.pushes}</td>
                    <td className={`border p-2 ${mb.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(mb.roi * 100).toFixed(2)}%
                    </td>
                    <td className={`border p-2 ${mb.avgCLV > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(mb.avgCLV * 100).toFixed(2)}%
                    </td>
                    <td className="border p-2">{(mb.avgEdge * 100).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No settled data yet</p>
        )}
      </section>

      {/* Market Section */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Market Intelligence</h2>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard title="Avg CLV" value={evaluations[0] ? `${(evaluations[0].metrics.avgCLV * 100).toFixed(2)}%` : 'N/A'} />
          <MetricCard title="CLV Beat Rate" value={evaluations[0] ? `${evaluations[0].metrics.avgCLV > 0 ? '>' : '<'} 0%` : 'N/A'} />
          <MetricCard title="Edge Stability" value={evaluations.filter(e => e.metrics.avgCLV > 0).length === evaluations.length ? 'Stable' : 'Variable'} />
        </div>
      </section>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="text-sm text-gray-500 mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
