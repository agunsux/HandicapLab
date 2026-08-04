import Link from 'next/link';
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase.server';
import { OpportunitiesTable, Opportunity } from '@/components/opportunities/OpportunitiesTable';
import { determineUserAccess } from '@/lib/signals/visibility';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || undefined;
  const { isPremium, dailyLimit } = await determineUserAccess(userId);

  // Fetch today's best value bets from the database
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*, fixtures(*)')
    .gte('fixtures.kickoff_time', new Date().toISOString())
    .order('expected_value', { ascending: false })
    .limit(10);

  // Map to Opportunity type for the table
  let mappedOpportunities: Opportunity[] = (predictions || []).map((p: any) => {
    let signal: 'VALUE' | 'WATCH' | 'PASS' = 'PASS';
    if (p.expected_value >= 3.0) signal = 'VALUE';
    else if (p.expected_value >= 1.0) signal = 'WATCH';

    const opp: Opportunity = {
      id: p.id,
      match: `${p.fixtures?.home_team} vs ${p.fixtures?.away_team}`,
      league: p.fixtures?.competition_name || 'Unknown',
      time: new Date(p.fixtures?.kickoff_time).toLocaleString(undefined, { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
      }),
      market: p.market,
      selection: p.selection,
      line: p.selection.includes('Handicap') ? p.selection.split(' ').pop() || '-' : '-',
      modelProb: (p.home_win_prob || p.model_probability || 0),
      marketOdds: p.odds || 0.00,
      fairOdds: p.fair_odds || 0.00,
      edge: p.expected_value || 0,
      ev: p.expected_value || 0, 
      signal,
      isStale: false
    };

    if (!isPremium) {
      opp.edge = undefined as any;
      opp.ev = undefined as any;
      opp.fairOdds = undefined as any;
      opp.marketOdds = undefined as any;
      opp.modelProb = undefined as any;
      opp.selection = 'HIDDEN';
    }

    return opp;
  });

  if (!isPremium) {
    mappedOpportunities = mappedOpportunities.slice(0, dailyLimit);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans text-foreground">
      {/* ============ COMPACT HERO ============ */}
      <section className="pt-16 pb-12 px-6 border-b border-border bg-background">
        <div className="container mx-auto max-w-7xl">
          <div className="max-w-3xl mb-12">
            {/* Brand Identity Lockup */}
            <div className="mb-6">
              <h2 className="text-xl font-display font-bold tracking-tight text-foreground uppercase">
                HANDICAPLAB
              </h2>
              <p className="text-sm text-terracotta font-mono mt-1">
                Where Odds Meet Evidence.
              </p>
            </div>
            
            {/* Main Statement */}
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-foreground mb-4 leading-tight">
              The Math Behind the Match.
            </h1>
            <p className="text-lg text-muted-foreground">
              Independent football intelligence for Asian Handicap, Over/Under, Moneyline &amp; BTTS.
            </p>
          </div>

          {/* Value Bets Table Header & Table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-mono font-bold uppercase tracking-widest text-foreground">Today's Value Bets</h3>
              <Link href="/app/value-bets" className="text-xs font-medium text-action-blue hover:text-action-blue-hover transition-colors">
                View All Opportunities &rarr;
              </Link>
            </div>
            
            {mappedOpportunities.length > 0 ? (
              <OpportunitiesTable data={mappedOpportunities} previewMode={true} />
            ) : (
              <div className="text-center py-12 border border-border rounded-lg bg-card">
                <div className="text-muted-foreground mb-4 uppercase tracking-widest text-xs font-bold">ENGINE STATUS</div>
                <div className="text-foreground font-medium mb-2">Scanning for validated opportunities.</div>
                <div className="text-muted-foreground text-sm">Check back before the next kickoff window.</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="py-24 px-6 border-b border-border bg-card">
        <div className="container mx-auto max-w-7xl">
          <h2 className="text-2xl font-display font-bold text-foreground mb-12 uppercase">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="text-terracotta font-mono font-bold text-lg mb-3">01 &mdash; MODEL</div>
              <p className="text-muted-foreground text-sm leading-relaxed">We estimate match probabilities using the platform's statistical models.</p>
            </div>
            <div>
              <div className="text-terracotta font-mono font-bold text-lg mb-3">02 &mdash; COMPARE</div>
              <p className="text-muted-foreground text-sm leading-relaxed">We compare model-derived fair prices against observed market prices.</p>
            </div>
            <div>
              <div className="text-terracotta font-mono font-bold text-lg mb-3">03 &mdash; ANALYSE</div>
              <p className="text-muted-foreground text-sm leading-relaxed">We identify statistically meaningful differences between the model and market.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ WHAT WE ARE NOT ============ */}
      <section className="py-24 px-6 bg-background border-b border-border">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-xl font-display font-bold text-foreground mb-8 uppercase tracking-widest text-terracotta">What We Are Not</h2>
          <div className="bg-card border border-border rounded-lg p-8 text-left mb-8">
            <p className="text-foreground font-medium mb-6">HandicapLab does not:</p>
            <ul className="space-y-4 text-muted-foreground font-mono text-sm">
              <li className="flex items-center gap-3"><span className="text-terracotta font-bold text-lg">&times;</span> accept wagers</li>
              <li className="flex items-center gap-3"><span className="text-terracotta font-bold text-lg">&times;</span> hold user funds</li>
              <li className="flex items-center gap-3"><span className="text-terracotta font-bold text-lg">&times;</span> place wagers</li>
              <li className="flex items-center gap-3"><span className="text-terracotta font-bold text-lg">&times;</span> operate a sportsbook</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            HandicapLab is a sports data and analytical platform. Analysis is provided for informational and research purposes only.
          </p>
        </div>
      </section>

    </div>
  );
}
