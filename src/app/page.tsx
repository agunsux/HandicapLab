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
      {/* ============ HEADER ============ */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between max-w-7xl">
          <Link href="/" className="font-display font-bold tracking-tight text-foreground text-lg">
            HANDICAPLAB
          </Link>
          <nav className="hidden md:flex gap-8 text-sm font-medium">
            <Link href="/markets" className="text-muted-foreground hover:text-foreground transition-colors">Markets</Link>
            <Link href="/research" className="text-muted-foreground hover:text-foreground transition-colors">Research</Link>
            <Link href="/methodology" className="text-muted-foreground hover:text-foreground transition-colors">Methodology</Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Login</Link>
            <Link href="/app" className="text-sm font-medium text-primary hover:text-primary-foreground transition-colors group flex items-center gap-1">
              Get Started <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="pt-24 pb-20 px-6 border-b border-border bg-card">
        <div className="container mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight text-foreground mb-6 uppercase leading-tight">
              FOOTBALL MARKET INTELLIGENCE.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-6">
              Measure probability, fair odds and expected value across global football markets.
            </p>
            <div className="text-sm font-medium text-muted-foreground mb-10 tracking-widest uppercase">
              Asian Handicap &middot; Over / Under &middot; Moneyline
            </div>
            <div className="flex items-center gap-4">
              <Link href="/app" className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-md hover:bg-action-blue-hover transition-colors shadow-elevation-1">
                Explore Opportunities
              </Link>
              <a href="#how-it-works" className="px-6 py-3 bg-secondary text-secondary-foreground font-medium rounded-md hover:bg-muted/80 transition-colors border border-border">
                How It Works
              </a>
            </div>
          </div>

          {/* HERO DATA PREVIEW */}
          <div className="bg-background rounded-lg border border-border p-6 shadow-elevation-2 font-mono">
            {mappedOpportunities.length > 0 ? (
              <div>
                <div className="flex justify-between items-start mb-6 pb-6 border-b border-border">
                  <div>
                    <div className="text-foreground font-bold tracking-tight mb-1 uppercase">{mappedOpportunities[0].match.split(' vs ')[0]} <span className="text-muted-foreground font-sans text-xs lowercase">vs</span> {mappedOpportunities[0].match.split(' vs ')[1]}</div>
                    <div className="text-muted-foreground text-xs">{mappedOpportunities[0].league}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground text-xs uppercase mb-1">{mappedOpportunities[0].market}</div>
                    <div className="text-foreground font-medium">{mappedOpportunities[0].selection} {mappedOpportunities[0].line !== '-' ? mappedOpportunities[0].line : ''}</div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Model Probability</span>
                    <span className="text-foreground">{(mappedOpportunities[0].modelProb * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Market Odds</span>
                    <span className="text-foreground">{mappedOpportunities[0].marketOdds.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Fair Odds</span>
                    <span className="text-foreground">{mappedOpportunities[0].fairOdds.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold pt-4 border-t border-border">
                    <span className="text-foreground">Expected Value</span>
                    <span className="text-signal-positive">+{mappedOpportunities[0].ev.toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
                  <div className="px-2 py-1 bg-signal-positive-bg text-signal-positive text-[10px] font-bold tracking-widest rounded border border-signal-positive/20 uppercase">
                    VALUE
                  </div>
                  <div className="text-xs text-muted-foreground">
                    DATA IS LIVE
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4 uppercase tracking-widest text-xs font-bold">ENGINE STATUS</div>
                <div className="text-foreground font-medium mb-2">Scanning for validated opportunities.</div>
                <div className="text-muted-foreground text-sm">Check back before the next kickoff window.</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============ TRACK RECORD ============ */}
      <section className="py-16 px-6 border-b border-border bg-background">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 border border-border rounded-lg bg-card">
              <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest mb-2">Coverage</div>
              <div className="text-2xl font-display font-medium text-foreground">10 Leagues Tracked</div>
            </div>
            <div className="p-6 border border-border rounded-lg bg-card">
              <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest mb-2">Signals Settled</div>
              <div className="text-2xl font-display font-medium text-foreground">Building...</div>
            </div>
            <div className="p-6 border border-border rounded-lg bg-card">
              <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest mb-2">Scientific Status</div>
              <div className="text-2xl font-display font-medium text-foreground">Building</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" className="py-24 px-6 border-b border-border bg-card">
        <div className="container mx-auto max-w-7xl">
          <h2 className="text-3xl font-display font-bold text-foreground mb-16 uppercase">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="text-terracotta font-mono font-bold text-xl mb-4">01 &mdash; MODEL</div>
              <p className="text-muted-foreground">We estimate match probabilities using the platform's statistical models.</p>
            </div>
            <div>
              <div className="text-terracotta font-mono font-bold text-xl mb-4">02 &mdash; COMPARE</div>
              <p className="text-muted-foreground">We compare model-derived fair prices against observed market prices.</p>
            </div>
            <div>
              <div className="text-terracotta font-mono font-bold text-xl mb-4">03 &mdash; ANALYSE</div>
              <p className="text-muted-foreground">We identify statistically meaningful differences between the model and market.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ THREE MARKETS ============ */}
      <section className="py-24 px-6 border-b border-border bg-background">
        <div className="container mx-auto max-w-7xl">
          <h2 className="text-3xl font-display font-bold text-foreground mb-16 uppercase">Analyzed Markets</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 border border-border rounded-lg bg-card">
              <h3 className="text-xl font-medium text-foreground mb-3 font-display">Moneyline</h3>
              <p className="text-muted-foreground text-sm">Match outcome probability and fair-price analysis.</p>
            </div>
            <div className="p-8 border border-border rounded-lg bg-card">
              <h3 className="text-xl font-medium text-foreground mb-3 font-display">Asian Handicap</h3>
              <p className="text-muted-foreground text-sm">Modelled probability and price analysis across handicap lines.</p>
            </div>
            <div className="p-8 border border-border rounded-lg bg-card">
              <h3 className="text-xl font-medium text-foreground mb-3 font-display">Over / Under</h3>
              <p className="text-muted-foreground text-sm">Goal-total probability and market-price analysis.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ WHAT WE ARE NOT ============ */}
      <section className="py-24 px-6 bg-card border-b border-border">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-display font-bold text-foreground mb-8 uppercase tracking-widest text-terracotta">What We Are Not</h2>
          <div className="bg-background border border-border rounded-lg p-8 text-left mb-8">
            <p className="text-foreground font-medium mb-6">HandicapLab does not:</p>
            <ul className="space-y-4 text-muted-foreground font-mono text-sm">
              <li className="flex items-center gap-3"><span className="text-destructive font-bold text-lg">&times;</span> accept wagers</li>
              <li className="flex items-center gap-3"><span className="text-destructive font-bold text-lg">&times;</span> hold user funds</li>
              <li className="flex items-center gap-3"><span className="text-destructive font-bold text-lg">&times;</span> place wagers</li>
              <li className="flex items-center gap-3"><span className="text-destructive font-bold text-lg">&times;</span> operate a sportsbook</li>
              <li className="flex items-center gap-3"><span className="text-destructive font-bold text-lg">&times;</span> receive payment for sportsbook referrals</li>
              <li className="flex items-center gap-3"><span className="text-destructive font-bold text-lg">&times;</span> guarantee outcomes</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            HandicapLab is a sports data and analytical platform. Analysis is provided for informational and research purposes only.
          </p>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="py-12 px-6 bg-background">
        <div className="container mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="font-display font-bold text-foreground text-xl tracking-tight">HANDICAPLAB</div>
          <div className="text-xs text-muted-foreground max-w-2xl text-center md:text-right leading-relaxed">
            HandicapLab is a sports data and analytical platform. It does not accept wagers, operate sportsbooks, or facilitate betting transactions. Analysis is provided for informational and research purposes only. Past performance does not guarantee future results.
          </div>
        </div>
      </footer>
    </div>
  );
}
