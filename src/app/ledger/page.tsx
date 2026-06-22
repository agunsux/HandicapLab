import { supabase } from '@/lib/supabase';
import { getModelPerformance } from '@/services/model.performance';
import { StatCard } from '@/components/StatCard';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import Link from 'next/link';

export const revalidate = 3600;

export default async function Ledger() {
  const stats = await getModelPerformance('v0.1');
  
  const { data: outcomes } = await supabase
    .from('outcomes')
    .select(`
      id,
      roi,
      result_ah,
      result_ml,
      settled_at,
      match_id,
      matches(
        home_team:teams!home_team_id(name),
        away_team:teams!away_team_id(name),
        league
      ),
      predictions(final_confidence)
    `)
    .order('settled_at', { ascending: false })
    .limit(50);

  return (
    <main className="min-h-screen bg-slate-50 pb-20 pt-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Public Ledger</h1>
            <p className="text-slate-500 font-medium mt-1">Transparent historical performance of Model v0.1</p>
          </div>
          <Link href="/" className="text-sm font-semibold text-blue-600 hover:text-blue-800">
            Back to Today →
          </Link>
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard title="Total Predictions" value={stats.total_predictions} />
          <StatCard title="Overall Yield" value={`${stats.yield_percentage.toFixed(2)}%`} trend={stats.yield_percentage >= 0 ? 'up' : 'down'} />
          <StatCard title="AH Hit Rate" value={`${(stats.hit_rate.ah * 100).toFixed(1)}%`} />
          <StatCard title="ML Hit Rate" value={`${(stats.hit_rate.ml * 100).toFixed(1)}%`} />
        </div>

        {/* Ledger Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">AH Result</th>
                <th className="px-4 py-3">ML Result</th>
                <th className="px-4 py-3 text-right">Net ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {outcomes?.map((o: any) => {
                const match = Array.isArray(o.matches) ? o.matches[0] : o.matches;
                const pred = Array.isArray(o.predictions) ? o.predictions[0] : o.predictions;
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(o.settled_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {match?.home_team.name} vs {match?.away_team.name}
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge confidence={pred?.final_confidence || 0} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`uppercase font-bold text-xs ${o.result_ah === 'win' ? 'text-emerald-500' : o.result_ah === 'loss' ? 'text-rose-500' : 'text-slate-400'}`}>
                        {o.result_ah}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`uppercase font-bold text-xs ${o.result_ml === 'win' ? 'text-emerald-500' : o.result_ml === 'loss' ? 'text-rose-500' : 'text-slate-400'}`}>
                        {o.result_ml}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${o.roi > 0 ? 'text-emerald-600' : o.roi < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {o.roi > 0 ? '+' : ''}{o.roi?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                );
              })}
              {(!outcomes || outcomes.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No evaluated outcomes yet. Check back after matches finish.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
