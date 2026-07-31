import Link from 'next/link';
import { ArrowRight, Activity, Database, HeartPulse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase.server';
import { getProviderHealth } from '@/lib/providers/quotaManager';
import { OpportunitiesTable, Opportunity } from '@/components/opportunities/OpportunitiesTable';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const healthData = await getProviderHealth();
  
  // Fetch today's best value bets from the database
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*, fixtures(*)')
    .gte('fixtures.kickoff_time', new Date().toISOString())
    .order('expected_value', { ascending: false })
    .limit(10);

  // Map to Opportunity type for the table
  const mappedOpportunities: Opportunity[] = (predictions || []).map((p: any) => ({
    id: p.id,
    match: `${p.fixtures?.home_team} vs ${p.fixtures?.away_team}`,
    league: p.fixtures?.competition_name || 'Unknown',
    time: new Date(p.fixtures?.kickoff_time).toLocaleString(),
    market: p.market,
    selection: p.selection,
    bookmaker: p.bookmaker || 'Pinnacle',
    odds: p.odds?.toFixed(2) || '0.00',
    fairOdds: p.fair_odds?.toFixed(2) || '0.00',
    edge: p.expected_value || 0,
    confidence: p.confidence_grade || 'C',
  }));

  return (
    <div className="flex flex-col min-h-screen">
      {/* ============ HERO ============ */}
      <section className="relative pt-12 pb-8 px-4 border-b">
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            Prematch Value Opportunities
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Live expected value edges for Moneyline, Asian Handicap, Over/Under, and BTTS.
          </p>
        </div>
      </section>

      {/* ============ SYSTEM STATUS DASHBOARD ============ */}
      <section className="py-8 bg-muted/10 border-b border-border px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium uppercase">Pipeline Status</p>
                <p className="font-bold text-lg">Active (5 Stages)</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl border flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg text-green-600">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium uppercase">API Usage Today</p>
                <p className="font-bold text-lg">
                  {healthData.reduce((acc, h) => acc + h.quotaUsed, 0)} Requests
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <HeartPulse className="w-5 h-5 text-gray-400" />
                <p className="text-sm text-gray-500 font-medium uppercase">Provider Health</p>
              </div>
              <div className="flex gap-2 text-xs">
                {healthData.map(h => (
                  <span key={h.provider} className={`px-2 py-1 rounded-md ${h.healthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {h.provider.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ LIVE PREVIEW ============ */}
      <section className="py-12 px-4 flex-1">
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Today's Best Value Bets</h2>
            </div>
            <Button variant="outline" asChild>
              <Link href="/admin/system">View Admin Dashboard</Link>
            </Button>
          </div>

          {mappedOpportunities.length > 0 ? (
            <OpportunitiesTable data={mappedOpportunities} previewMode={false} />
          ) : (
            <div className="text-center py-20 border rounded-xl bg-gray-50">
              <p className="text-gray-500">No value opportunities discovered yet for today.</p>
              <p className="text-sm text-gray-400 mt-2">Pipeline runs every 30 minutes.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
