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
    <div className="flex flex-col min-h-screen bg-background">
      {/* ============ HEADER ============ */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-mono font-bold tracking-tight text-foreground">
            HANDICAPLAB
          </Link>
          <nav className="hidden md:flex gap-6 text-sm font-medium">
            <Link href="/methodology" className="text-muted-foreground hover:text-foreground transition-colors">Methodology</Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Log in</Link>
            <Link href="/app" className="text-sm font-medium bg-foreground text-background px-4 py-2 rounded-md hover:bg-foreground/90 transition-colors">Open App</Link>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="pt-12 pb-8 px-4 border-b border-border">
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-3 font-mono uppercase">
            Sports Data, Not Sports Hype.
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl">
            Identify statistical inefficiencies and betting market edges with quantitative modeling. Below is a live preview of today's market pulse.
          </p>
        </div>
      </section>

      {/* ============ LIVE OPPORTUNITIES PREVIEW ============ */}
      <section className="py-12 px-4 flex-1">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Live Market Pulse</h2>
            <Link href="/app/picks" className="text-sm font-medium text-primary hover:underline">View All Opportunities &rarr;</Link>
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none items-center border-b border-border">
            <button className="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-[1px] border-primary text-foreground">All</button>
            <button className="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-[1px] border-transparent text-muted-foreground hover:text-foreground">Moneyline</button>
            <button className="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-[1px] border-transparent text-muted-foreground hover:text-foreground">Asian Handicap</button>
          </div>

          <OpportunitiesTable data={mappedOpportunities} previewMode={true} />
          
          <div className="mt-8 text-center p-8 border border-border rounded-xl bg-card">
            <h3 className="text-lg font-bold mb-2">Access Full Market Intelligence</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
              Join HandicapLab to access live data across 12+ leagues, deeper analytical models, and historical track record validation.
            </p>
            <Link href="/pricing" className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
              View Pricing Plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
