import Link from 'next/link';
import { ArrowRight, CheckCircle2, Shield, Activity, BarChart3, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OpportunitiesTable, Opportunity } from '@/components/opportunities/OpportunitiesTable';

const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: '1',
    match: 'Arsenal vs Liverpool',
    league: 'Premier League',
    time: 'Today, 20:00',
    market: 'Asian Handicap',
    selection: 'Arsenal -0.5',
    bookmaker: 'Pinnacle',
    odds: '1.95',
    fairOdds: '1.82',
    edge: 7.1,
    confidence: 'A+',
  },
  {
    id: '2',
    match: 'Real Madrid vs Barcelona',
    league: 'La Liga',
    time: 'Today, 21:00',
    market: 'Total Goals',
    selection: 'Over 2.5',
    bookmaker: 'Pinnacle',
    odds: '1.85',
    fairOdds: '1.75',
    edge: 5.7,
    confidence: 'A',
  },
  {
    id: '3',
    match: 'Juventus vs AC Milan',
    league: 'Serie A',
    time: 'Tomorrow, 19:45',
    market: 'Match Odds',
    selection: 'Juventus',
    bookmaker: 'Pinnacle',
    odds: '2.20',
    fairOdds: '2.08',
    edge: 5.8,
    confidence: 'A',
  },
  {
    id: '4',
    match: 'Bayern Munich vs Dortmund',
    league: 'Bundesliga',
    time: 'Tomorrow, 18:30',
    market: 'Asian Handicap',
    selection: 'Dortmund +1.5',
    bookmaker: 'Pinnacle',
    odds: '1.78',
    fairOdds: '1.71',
    edge: 4.1,
    confidence: 'B+',
  },
  {
    id: '5',
    match: 'PSG vs Lyon',
    league: 'Ligue 1',
    time: 'Sun, 20:00',
    market: 'Total Goals',
    selection: 'Under 3.5',
    bookmaker: 'Pinnacle',
    odds: '1.65',
    fairOdds: '1.58',
    edge: 4.4,
    confidence: 'B+',
  }
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24 px-4 text-center">
        <div className="container mx-auto max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-primary"></span>
            </span>
            42 Verified Opportunities • Updated 2 minutes ago
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6 leading-tight">
            Today's Best <br className="hidden md:block"/> Value Bets
          </h1>
          
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Stop gambling. Start investing. Identify mathematical edges across global football markets with professional-grade decision intelligence.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="h-12 px-8 text-base font-semibold rounded-full" asChild>
              <Link href="/live">View Today's Edges <ArrowRight className="ml-2 size-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base font-semibold rounded-full bg-transparent border-border hover:bg-muted" asChild>
              <Link href="/results">See Live Results</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Live Preview Section */}
      <section className="py-16 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Live Market Edges</h2>
              <p className="text-muted-foreground mt-1 text-sm">Preview of top confidence opportunities available right now.</p>
            </div>
          </div>
          
          <OpportunitiesTable data={MOCK_OPPORTUNITIES} previewMode={true} />
          
          <div className="mt-8 text-center">
            <Button variant="secondary" className="rounded-full font-medium" asChild>
              <Link href="/live">View All 42 Opportunities <ChevronRight className="ml-1 size-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Why HandicapLab */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card border border-border p-8 rounded-2xl">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Shield className="size-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Verified Edges</h3>
              <p className="text-muted-foreground leading-relaxed">
                Every recommendation is publicly tracked against closing line value. We focus on mathematical truth, not guaranteed wins.
              </p>
            </div>
            
            <div className="bg-card border border-border p-8 rounded-2xl">
              <div className="size-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                <Activity className="size-6 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Transparent Results</h3>
              <p className="text-muted-foreground leading-relaxed">
                Win or lose, every result stays public. Our track record is an open ledger verifiable by anyone at any time.
              </p>
            </div>
            
            <div className="bg-card border border-border p-8 rounded-2xl">
              <div className="size-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-6">
                <BarChart3 className="size-6 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Professional Analysis</h3>
              <p className="text-muted-foreground leading-relaxed">
                Evidence before opinion. We distill complex statistical models into clear, actionable human language.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Track Record Snapshot */}
      <section className="py-24 bg-muted/30 border-y border-border">
        <div className="container mx-auto max-w-4xl text-center px-4">
          <h2 className="text-3xl font-bold tracking-tight mb-12">Track Record</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-4xl font-bold text-foreground font-mono mb-2">4.2%</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">All-Time ROI</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-foreground font-mono mb-2">12.5k</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Verified Picks</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-foreground font-mono mb-2">68%</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">CLV Beat Rate</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-foreground font-mono mb-2">1,240</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Active Users</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Start making better decisions.</h2>
          <p className="text-muted-foreground mb-12 max-w-xl mx-auto">Get access to today's best edges immediately.</p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto text-left">
            <div className="border border-border bg-background p-8 rounded-2xl flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <p className="text-muted-foreground mb-6">Basic market overview.</p>
              <div className="text-4xl font-bold font-mono mb-8">$0<span className="text-base text-muted-foreground font-sans">/mo</span></div>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3"><CheckCircle2 className="size-5 text-primary shrink-0" /><span className="text-sm">View up to 3 edges per day</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 className="size-5 text-primary shrink-0" /><span className="text-sm">Basic match statistics</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 className="size-5 text-primary shrink-0" /><span className="text-sm">Public track record access</span></li>
              </ul>
              
              <Button variant="outline" className="w-full rounded-full border-border">Create Free Account</Button>
            </div>

            <div className="border border-premium-gold/30 bg-card p-8 rounded-2xl flex flex-col relative shadow-lg">
              <div className="absolute -top-3 inset-x-0 flex justify-center">
                <span className="bg-premium-gold text-black text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">Most Popular</span>
              </div>
              <h3 className="text-2xl font-bold mb-2 text-premium-gold">Pro</h3>
              <p className="text-muted-foreground mb-6">Full professional intelligence.</p>
              <div className="text-4xl font-bold font-mono mb-8">$29<span className="text-base text-muted-foreground font-sans">/mo</span></div>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3"><CheckCircle2 className="size-5 text-premium-gold shrink-0" /><span className="text-sm">Unlimited edges & alerts</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 className="size-5 text-premium-gold shrink-0" /><span className="text-sm">Full Premium Detail Panel</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 className="size-5 text-premium-gold shrink-0" /><span className="text-sm">Advanced diagnostics & Brier Score</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 className="size-5 text-premium-gold shrink-0" /><span className="text-sm">Priority Support</span></li>
              </ul>
              
              <Button className="w-full rounded-full bg-premium-gold text-black hover:bg-premium-gold/90 font-semibold">Start 7-Day Trial</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}