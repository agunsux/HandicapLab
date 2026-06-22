import { supabase } from '@/lib/supabase';
import { MatchCard } from '@/components/MatchCard';
import { FilterBar } from '@/components/FilterBar';

export const revalidate = 3600; // revalidate every hour

export default async function Home() {
  // Fetch today's scheduled matches with predictions
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id,
      match_date,
      league,
      status,
      home_team:teams!home_team_id(name),
      away_team:teams!away_team_id(name),
      predictions(
        ah_home_prob,
        ah_away_prob,
        ou_over_prob,
        ou_under_prob,
        ml_home_prob,
        ml_draw_prob,
        ml_away_prob,
        btts_yes_prob,
        btts_no_prob,
        final_confidence
      )
    `)
    .eq('status', 'scheduled')
    .order('match_date', { ascending: true })
    .limit(20);

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-6 px-4 mb-8">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">HandicapLab</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Market Intelligence Ledger</p>
          </div>
          <div className="flex gap-3">
            <a href="/ledger" className="text-sm font-semibold text-slate-600 hover:text-slate-900">Ledger</a>
            <a href="/pricing" className="text-sm font-semibold text-slate-600 hover:text-slate-900">Pricing</a>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-bold text-slate-800">Today's Predictions</h2>
          <span className="text-sm text-slate-500 font-medium">Model v0.1</span>
        </div>
        
        <FilterBar />

        {(!matches || matches.length === 0) ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
            <p className="text-slate-500 font-medium">No predictions available for today yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {matches.map((match: any) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                prediction={match.predictions?.[0]} 
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
