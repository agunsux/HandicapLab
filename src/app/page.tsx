import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  Activity,
  BarChart3,
  ChevronRight,
  LineChart,
  Target,
  Lock,
  Sparkles,
  TrendingUp,
  Scale,
  FlaskConical,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OpportunitiesTable, Opportunity } from '@/components/opportunities/OpportunitiesTable';
import { StructuredData } from '@/components/StructuredData';

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
  },
];

const FAQS = [
  {
    q: 'What is HandicapLab?',
    a: 'HandicapLab is a football market intelligence platform. We use quantitative modeling to identify statistical inefficiencies and betting market edges, then present them with transparent, verifiable metrics.',
  },
  {
    q: 'Is this a prediction service?',
    a: 'No. We sell intelligence, not predictions. Every opportunity is presented with its statistical breakdown, expected value, and closing line value — so you can make your own informed decisions.',
  },
  {
    q: 'How is performance validated?',
    a: 'Every recommendation is publicly tracked against Pinnacle closing lines. Our track record is an open ledger, verifiable by anyone, with Brier scores, calibration curves, and ROI metrics.',
  },
  {
    q: 'What is the money-back guarantee?',
    a: 'We offer a 30-day, no-questions-asked money-back guarantee on all paid plans. If you are not satisfied, contact us within 30 days for a full refund.',
  },
  {
    q: 'Do I need a credit card for the trial?',
    a: 'No. Our 14-day free trial requires no credit card. You get full access to evaluate the platform before committing.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'The CLV tracking is what sold me. I can finally see whether my edge is real or just variance. This is the Bloomberg terminal of football analytics.',
    name: 'Daniel R.',
    role: 'Quantitative Analyst',
  },
  {
    quote:
      'I stopped chasing tipsters years ago. HandicapLab is the first platform that treats betting like an investment discipline, not a lottery.',
    name: 'Marcus T.',
    role: 'Professional Bettor',
  },
  {
    quote:
      'The calibration curves and Brier scores give me confidence the models are honest. No hype, just evidence.',
    name: 'Sofia L.',
    role: 'Data Scientist',
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <StructuredData
        type="Organization"
        data={{
          name: 'HandicapLab',
          url: 'https://handicaplab.com',
          description:
            'Football market intelligence platform. Quantitative modeling, closing line value, and transparent historical validation.',
        }}
      />

      {/* ============ HERO ============ */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 px-4 overflow-hidden">
        <div className="container mx-auto max-w-5xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-primary"></span>
            </span>
            Live Market Intelligence · Updated 2 minutes ago
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6 leading-tight">
            Football market intelligence,
            <br className="hidden md:block" />
            <span className="text-primary"> engineered for edge.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Identify statistical inefficiencies across global football markets
            with quantitative modeling, closing line value, and transparent
            historical validation. Intelligence, not predictions.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="h-12 px-8 text-base font-semibold rounded-full" asChild>
              <Link href="/pricing">
                Start Free 14-Day Trial <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base font-semibold rounded-full bg-transparent border-border hover:bg-muted"
              asChild
            >
              <Link href="/live">View Live Predictions</Link>
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* ============ SOCIAL PROOF ============ */}
      <section className="py-12 border-y border-border bg-muted/20">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-foreground font-mono mb-1">4.2%</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">All-Time ROI</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-foreground font-mono mb-1">12.5k</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Verified Picks</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-foreground font-mono mb-1">68%</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">CLV Beat Rate</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-foreground font-mono mb-1">0.21</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Brier Score</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ LIVE PREVIEW ============ */}
      <section className="py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Today's Opportunities</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Top confidence edges available right now, ranked by expected value.
              </p>
            </div>
          </div>

          <OpportunitiesTable data={MOCK_OPPORTUNITIES} previewMode={true} />

          <div className="mt-8 text-center">
            <Button variant="secondary" className="rounded-full font-medium" asChild>
              <Link href="/live">
                View All Opportunities <ChevronRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="py-16 md:py-24 bg-muted/20 border-y border-border px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-3">How It Works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From raw data to actionable intelligence in three disciplined steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <BarChart3 className="size-6 text-primary" />,
                step: '01',
                title: 'Ingest & Model',
                desc: 'We aggregate fixtures, statistics, and Pinnacle odds, then run quantitative models to estimate true probabilities.',
              },
              {
                icon: <Target className="size-6 text-primary" />,
                step: '02',
                title: 'Detect Edge',
                desc: 'We compare model probabilities against market odds to surface statistical inefficiencies with positive expected value.',
              },
              {
                icon: <TrendingUp className="size-6 text-primary" />,
                step: '03',
                title: 'Track & Validate',
                desc: 'Every recommendation is tracked against closing lines. Performance is published transparently for full accountability.',
              },
            ].map((item) => (
              <div key={item.step} className="bg-card border border-border p-8 rounded-2xl elevation-1">
                <div className="flex items-center justify-between mb-6">
                  <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="font-mono text-3xl font-bold text-muted-foreground/30">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ WHY HANDICAPLAB ============ */}
      <section className="py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Why HandicapLab</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Built like an institutional research desk, not a tipster site.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card border border-border p-8 rounded-2xl">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Shield className="size-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Verified Edges</h3>
              <p className="text-muted-foreground leading-relaxed">
                Every recommendation is publicly tracked against closing line
                value. We focus on mathematical truth, not guaranteed wins.
              </p>
            </div>

            <div className="bg-card border border-border p-8 rounded-2xl">
              <div className="size-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                <Activity className="size-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Transparent Results</h3>
              <p className="text-muted-foreground leading-relaxed">
                Win or lose, every result stays public. Our track record is an
                open ledger verifiable by anyone at any time.
              </p>
            </div>

            <div className="bg-card border border-border p-8 rounded-2xl">
              <div className="size-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-6">
                <Scale className="size-6 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Scientific Method</h3>
              <p className="text-muted-foreground leading-relaxed">
                Calibration curves, Brier scores, and walk-forward validation.
                No overfitting, no survivorship bias, no inflated claims.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ MODEL TRANSPARENCY ============ */}
      <section className="py-16 md:py-24 bg-muted/20 border-y border-border px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">Model Transparency</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                No black boxes. Every prediction comes with a statistical
                breakdown you can inspect and verify.
              </p>
              <ul className="space-y-4">
                {[
                  'Expected goals (xG) indicators',
                  'ELO rating shifts',
                  'Home advantage values',
                  'Model agreement scores',
                  'Confidence intervals',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8 elevation-2">
              <div className="flex items-center gap-2 mb-6">
                <FlaskConical className="size-5 text-primary" />
                <span className="font-semibold">Sample Model Breakdown</span>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'xG Model', value: '1.82', note: 'expected goals' },
                  { label: 'ELO Shift', value: '+14', note: 'vs opponent' },
                  { label: 'Home Advantage', value: '+0.32', note: 'xG adjustment' },
                  { label: 'Model Agreement', value: '3 / 4', note: 'models aligned' },
                  { label: 'Confidence Interval', value: '±2.1%', note: '95% CI' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-foreground">{row.value}</div>
                      <div className="text-xs text-muted-foreground">{row.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PERFORMANCE METRICS ============ */}
      <section className="py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Performance Metrics</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              We measure what matters: edge, calibration, and closing line value.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Closing Line Value', value: '+2.4%', icon: <LineChart className="size-5 text-primary" /> },
              { label: 'Expected Value', value: '+5.1%', icon: <Target className="size-5 text-primary" /> },
              { label: 'Calibration', value: '0.21', icon: <Activity className="size-5 text-primary" /> },
              { label: 'Win Rate', value: '54.2%', icon: <TrendingUp className="size-5 text-primary" /> },
            ].map((metric) => (
              <div key={metric.label} className="bg-card border border-border rounded-2xl p-6 elevation-1">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  {metric.icon}
                </div>
                <div className="font-mono text-2xl font-bold text-foreground mb-1">{metric.value}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SCIENTIFIC VALIDATION ============ */}
      <section className="py-16 md:py-24 bg-muted/20 border-y border-border px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="bg-card border border-border rounded-2xl p-8 elevation-2">
              <div className="flex items-center gap-2 mb-6">
                <Lock className="size-5 text-primary" />
                <span className="font-semibold">Validation Protocol</span>
              </div>
              <ul className="space-y-4">
                {[
                  'Walk-forward validation to prevent future leakage',
                  'Out-of-sample testing on held-out seasons',
                  'Brier score calibration monitoring',
                  'No extraordinary results without audit',
                  'Pinnacle closing line as ground truth',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">Scientific Validation</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Our research follows strict statistical governance. If a result
                looks too good to be true, we audit it before publishing.
              </p>
              <Button variant="outline" className="rounded-full" asChild>
                <Link href="/methodology">
                  Read Our Methodology <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className="py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Trusted by Serious Bettors</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Analysts, data scientists, and disciplined investors use HandicapLab.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="bg-card border border-border rounded-2xl p-8 elevation-1">
                <blockquote className="text-muted-foreground leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption>
                  <div className="font-semibold text-foreground">{t.name}</div>
                  <div className="text-sm text-muted-foreground">{t.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section className="py-16 md:py-24 bg-muted/20 border-y border-border px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Start making better decisions.</h2>
          <p className="text-muted-foreground mb-12 max-w-xl mx-auto">
            Get access to today's best edges immediately. 14-day free trial, no
            credit card required.
          </p>

          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto text-left">
            <div className="border border-border bg-background p-8 rounded-2xl flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <p className="text-muted-foreground mb-6">Basic market overview.</p>
              <div className="text-4xl font-bold font-mono mb-8">
                $0<span className="text-base text-muted-foreground font-sans">/mo</span>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-primary shrink-0" />
                  <span className="text-sm">View up to 3 edges per day</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-primary shrink-0" />
                  <span className="text-sm">Basic match statistics</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-primary shrink-0" />
                  <span className="text-sm">Public track record access</span>
                </li>
              </ul>

              <Button variant="outline" className="w-full rounded-full border-border" asChild>
                <Link href="/pricing">Create Free Account</Link>
              </Button>
            </div>

            <div className="border border-primary/30 bg-card p-8 rounded-2xl flex flex-col relative elevation-2">
              <div className="absolute -top-3 inset-x-0 flex justify-center">
                <span className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                  Most Popular
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-2 text-primary">Pro</h3>
              <p className="text-muted-foreground mb-6">Full professional intelligence.</p>
              <div className="text-4xl font-bold font-mono mb-8">
                $29<span className="text-base text-muted-foreground font-sans">/mo</span>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-primary shrink-0" />
                  <span className="text-sm">Unlimited edges & alerts</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-primary shrink-0" />
                  <span className="text-sm">Full Premium Detail Panel</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-primary shrink-0" />
                  <span className="text-sm">Advanced diagnostics & Brier Score</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-primary shrink-0" />
                  <span className="text-sm">Priority Support</span>
                </li>
              </ul>

              <Button className="w-full rounded-full font-semibold" asChild>
                <Link href="/pricing">Start 14-Day Free Trial</Link>
              </Button>
            </div>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            All paid plans include our 30-day money-back guarantee.
          </p>
        </div>
      </section>

      {/* ============ MONEY-BACK GUARANTEE ============ */}
      <section className="py-16 md:py-20 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-primary/10 mb-6">
            <Shield className="size-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-4">30-Day Money-Back Guarantee</h2>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            We are confident in the quality of our intelligence. If you are not
            satisfied within 30 days of your purchase, contact us and we will
            refund you in full. No questions asked.
          </p>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="py-16 md:py-24 bg-muted/20 border-y border-border px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group bg-card border border-border rounded-xl p-6">
                <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground list-none">
                  {faq.q}
                  <ChevronRight className="size-5 text-muted-foreground transition-transform group-open:rotate-90 shrink-0 ml-4" />
                </summary>
                <p className="mt-4 text-muted-foreground leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="py-20 md:py-28 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="size-4" />
            Start your 14-day free trial
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Make data-driven decisions.
            <br className="hidden md:block" />
            <span className="text-primary">Not guesses.</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Join serious bettors and analysts who rely on transparent,
            validated football market intelligence.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="h-12 px-8 text-base font-semibold rounded-full" asChild>
              <Link href="/pricing">
                Start Free 14-Day Trial <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base font-semibold rounded-full bg-transparent border-border hover:bg-muted"
              asChild
            >
              <Link href="/blog">
                <BookOpen className="mr-2 size-4" /> Read the Blog
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required · 30-day money-back guarantee
          </p>
        </div>
      </section>
    </div>
  );
}
