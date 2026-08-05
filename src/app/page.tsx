import Link from 'next/link';
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase.server';
import { OpportunitiesTable, Opportunity } from '@/components/opportunities/OpportunitiesTable';
import { cn } from '@/lib/utils';
import { getSecureOpportunities } from '@/services/opportunities.service';
import { Shield, BrainCircuit, Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id') || undefined;
  
  // Fetch 2 best value bets for the teaser securely via DTO
  const mappedOpportunities = await getSecureOpportunities(userId, 2);

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans text-foreground">
      
      {/* 2. HERO */}
      <section className="pt-24 pb-20 border-b border-border bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-display font-bold tracking-tight text-foreground uppercase mb-2">
              Where Odds Meet Evidence.
            </h2>
            <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-foreground mb-6 leading-tight">
              The Math Behind<br />The Match.
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Quantitative modeling, closing line value analysis, and statistical edges. 
              We uncover market inefficiencies using mathematical rigor.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link 
                href="/pricing"
                className="px-6 py-3 bg-terracotta text-white font-semibold rounded-md hover:bg-terracotta-muted transition-colors"
              >
                Get Pro Access
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. LIVE SIGNAL PREVIEW */}
      <section className="py-24 border-b border-border bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl font-display font-bold mb-2">Live Signal Preview</h2>
              <p className="text-muted-foreground">Real-time value bets detected across global football markets.</p>
            </div>
          </div>
          
          <div className="relative rounded-lg overflow-hidden border border-border bg-background">
            <div className={cn("p-1", !userId && "filter blur-[6px] opacity-60 select-none pointer-events-none")}>
              {mappedOpportunities.length > 0 ? (
                <OpportunitiesTable data={mappedOpportunities} previewMode={true} />
              ) : (
                <div className="text-center py-12">
                  <div className="text-muted-foreground mb-4 uppercase tracking-widest text-xs font-bold">ENGINE STATUS</div>
                  <div className="text-foreground font-medium mb-2">Scanning for validated opportunities.</div>
                  <div className="text-muted-foreground text-sm">Check back before the next kickoff window.</div>
                </div>
              )}
            </div>

            {!userId && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/30">
                <div className="bg-card border border-border p-8 rounded-xl flex flex-col items-center shadow-2xl max-w-sm mx-4 text-center">
                  <div className="bg-terracotta/10 text-terracotta px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
                    Pro Access Required
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Market Data Locked</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Sign in to view real-time statistical edges, fair odds, and model probabilities.
                  </p>
                  <Link 
                    href="/pricing" 
                    className="w-full bg-foreground text-background px-4 py-3 rounded-md font-semibold text-sm hover:bg-muted-foreground transition-colors"
                  >
                    View Pricing
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. HONEST STAT STRIP */}
      <section className="py-8 bg-background border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
                <span className="text-terracotta font-mono font-bold">01</span>
              </div>
              <span className="font-semibold tracking-wide uppercase text-sm">No Tipsters.</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
                <span className="text-terracotta font-mono font-bold">02</span>
              </div>
              <span className="font-semibold tracking-wide uppercase text-sm">No Affiliates.</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
                <span className="text-terracotta font-mono font-bold">03</span>
              </div>
              <span className="font-semibold tracking-wide uppercase text-sm">Pure Mathematics.</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section className="py-24 border-b border-border bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <h2 className="text-3xl font-display font-bold mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="size-12 rounded-lg bg-background border border-border flex items-center justify-center mb-6 text-terracotta">
                <Activity className="size-6" />
              </div>
              <h3 className="font-bold text-xl mb-3">Model Probabilities</h3>
              <p className="text-muted-foreground leading-relaxed">
                Using Poisson distribution, Elo ratings, and Dixon-Coles adjustments to model expected outcomes accurately.
              </p>
            </div>
            <div>
              <div className="size-12 rounded-lg bg-background border border-border flex items-center justify-center mb-6 text-terracotta">
                <Shield className="size-6" />
              </div>
              <h3 className="font-bold text-xl mb-3">Compare to Market</h3>
              <p className="text-muted-foreground leading-relaxed">
                We continuously ingest pinnacle odds to map market prices against our derived fair odds.
              </p>
            </div>
            <div>
              <div className="size-12 rounded-lg bg-background border border-border flex items-center justify-center mb-6 text-terracotta">
                <BrainCircuit className="size-6" />
              </div>
              <h3 className="font-bold text-xl mb-3">Identify Edge</h3>
              <p className="text-muted-foreground leading-relaxed">
                Highlighting statistically meaningful differences where the market misprices expected value.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FOUR MARKETS */}
      <section className="py-24 bg-background border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <h2 className="text-3xl font-display font-bold mb-12 text-center">Core Markets</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-card border border-border rounded-lg p-6 text-center shadow-sm">
              <h3 className="font-bold text-lg">Moneyline</h3>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 text-center shadow-sm">
              <h3 className="font-bold text-lg">Asian Handicap</h3>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 text-center shadow-sm">
              <h3 className="font-bold text-lg">Over/Under</h3>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 text-center shadow-sm">
              <h3 className="font-bold text-lg">BTTS</h3>
            </div>
          </div>
        </div>
      </section>

      {/* 7. WHAT WE ARE NOT */}
      <section className="py-24 bg-card border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
          <h2 className="text-xl font-display font-bold text-foreground mb-8 uppercase tracking-widest text-terracotta">What We Are Not</h2>
          <div className="bg-background border border-border rounded-lg p-8 text-left mb-8 shadow-sm">
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

      {/* 8. CTA / VERIFICATION STATE */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
          <h2 className="text-3xl font-display font-bold mb-6">Historical Validation</h2>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            Our models are continuously backtested against closing lines to ensure positive expected value. 
            <strong> Live production track records will be published as predictions are settled.</strong>
          </p>
          <div className="inline-block bg-card border border-border rounded-full px-6 py-2">
            <span className="text-sm font-bold text-foreground">0 Settled Production Signals</span>
          </div>
        </div>
      </section>

    </div>
  );
}
