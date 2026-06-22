import { supabase } from '@/lib/supabase';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { StatCard } from '@/components/StatCard';
import { notFound } from 'next/navigation';

export default async function MatchDetail({ params }: { params: { id: string } }) {
  const { data: match } = await supabase
    .from('matches')
    .select(`
      id, match_date, league, status,
      home_team:teams!home_team_id(name),
      away_team:teams!away_team_id(name),
      predictions(*),
      stats_snapshots(*),
      market_snapshots(*)
    `)
    .eq('id', params.id)
    .single();

  if (!match) return notFound();

  const pred = match.predictions?.[0];
  const stats = match.stats_snapshots?.[0];
  const markets = match.market_snapshots?.[0];

  return (
    <main className="min-h-screen bg-slate-50 pb-20 pt-8">
      <div className="max-w-3xl mx-auto px-4">
        <a href="/" className="text-sm font-semibold text-blue-600 mb-6 inline-block">← Back to Predictions</a>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8 text-center">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{match.league}</p>
          <div className="flex justify-between items-center px-12">
            <h1 className="text-3xl font-black text-slate-900 w-2/5">{match.home_team.name}</h1>
            <span className="text-xl font-bold text-slate-300 w-1/5">VS</span>
            <h1 className="text-3xl font-black text-slate-900 w-2/5">{match.away_team.name}</h1>
          </div>
          <p className="text-sm font-medium text-slate-400 mt-4">
            {new Date(match.match_date).toLocaleString()}
          </p>
        </div>

        {pred && (
          <div className="mb-8">
            <div className="flex justify-between items-end mb-4">
              <h2 className="text-xl font-bold text-slate-900">Probability Breakdown</h2>
              <ConfidenceBadge confidence={pred.final_confidence} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <StatCard title="Home Win (ML)" value={`${(pred.ml_home_prob * 100).toFixed(1)}%`} />
              <StatCard title="Away Win (ML)" value={`${(pred.ml_away_prob * 100).toFixed(1)}%`} />
              <StatCard title={`Over ${markets?.over_under_line || 2.5}`} value={`${(pred.ou_over_prob * 100).toFixed(1)}%`} />
              <StatCard title={`Asian Handicap (${markets?.asian_handicap_line || 0}) Home`} value={`${(pred.ah_home_prob * 100).toFixed(1)}%`} />
            </div>
          </div>
        )}

        {stats && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Why? (Model Inputs)</h2>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <p className="text-slate-600 mb-6">Our deterministic model calculated these probabilities based on the following pre-match data snapshots:</p>
              
              <div className="space-y-4">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500 font-medium">Expected Goals (xG)</span>
                  <span className="font-bold text-slate-800">{stats.xg_home} - {stats.xg_away}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500 font-medium">Shots on Target</span>
                  <span className="font-bold text-slate-800">{stats.shots_on_target_home} - {stats.shots_on_target_away}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500 font-medium">Form Index (Max 5)</span>
                  <span className="font-bold text-slate-800">{stats.form_home} - {stats.form_away}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
