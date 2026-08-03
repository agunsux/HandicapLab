import Link from 'next/link';
import { ArrowRight, Activity, Gauge, Target, Wallet, Shield } from 'lucide-react';
import { DEMO_VALUE_BETS } from '@/app/app/_data/terminal';
import { ValueBetsFeed } from '@/components/terminal/ValueBetsFeed';

export const metadata = {
  title: 'Dashboard',
  description:
    'HandicapLab terminal dashboard — closing line value, model calibration, expected edge and portfolio metrics.',
};

export default function DashboardPage() {
  const topBets = [...DEMO_VALUE_BETS].sort((a, b) => b.ev - a.ev).slice(0, 5);

  const metrics = [
    { label: 'Avg CLV (7d)', value: '+2.4%', sub: 'Pinnacle close', icon: Gauge, positive: true },
    { label: 'Model Brier', value: '0.183', sub: 'Calibration', icon: Activity, positive: false },
    { label: 'Portfolio EV', value: '+4.6%', sub: 'Edge-weighted', icon: Target, positive: true },
    { label: 'Kelly Exposure', value: '3.2%', sub: 'Quarter Kelly', icon: Wallet, positive: false },
  ];

  return (
    <div className="flex flex-col space-y-6 pb-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-display font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Market intelligence summary — calibrated probabilities, expected value and closing line value.
        </p>
      </div>

      {/* Hero metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <m.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {m.label}
              </span>
            </div>
            <div
              className={
                'mt-3 text-2xl font-semibold tabular-nums tracking-tight ' +
                (m.positive ? 'text-signal-positive' : 'text-foreground')
              }
            >
              {m.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Market coverage */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(['asian_handicap', 'over_under', 'moneyline', 'btts'] as const).map((mk) => {
          const count = DEMO_VALUE_BETS.filter((b) => b.market === mk).length;
          return (
            <Link
              key={mk}
              href={`/app/markets/${mk === 'asian_handicap' ? 'asian-handicap' : mk === 'over_under' ? 'over-under' : mk}`}
              className="group flex items-center justify-between rounded-lg border border-border/70 bg-card px-4 py-3 transition-colors hover:border-border hover:bg-muted/30"
            >
              <div>
                <div className="text-sm font-medium text-foreground capitalize">
                  {mk === 'asian_handicap' ? 'Asian Handicap' : mk === 'over_under' ? 'Over / Under' : mk === 'moneyline' ? 'Moneyline' : 'BTTS'}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{count} value picks</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>

      {/* Top EV today */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Highest EV Today
          </h2>
          <Link
            href="/app/value-bets"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            All opportunities <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <ValueBetsFeed bets={topBets} />
      </div>

      {/* Research note */}
      <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          No extraordinary performance requires audit. Model remains within calibration bands across
          the league whitelist. Pinnacle remains the ground truth for CLV measurement.
        </p>
      </div>
    </div>
  );
}