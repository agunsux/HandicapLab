'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Scale, LineChart, Trophy, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEMO_VALUE_BETS, formatKickoff, MarketType, ValueBet } from '@/app/app/_data/terminal';

interface MatchDetailViewProps {
  matchId: string;
}

const MARKET_META: Record<MarketType, { icon: React.ElementType; label: string }> = {
  asian_handicap: { icon: Scale, label: 'Asian Handicap' },
  over_under: { icon: LineChart, label: 'Over / Under' },
  moneyline: { icon: Trophy, label: 'Moneyline' },
  btts: { icon: CircleDot, label: 'BTTS' },
};

function MarketCard({ bet }: { bet: ValueBet }) {
  const Meta = MARKET_META[bet.market];
  const movement = bet.lineMovement.current - bet.lineMovement.opening;
  const isDrifting = movement > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Meta.icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{Meta.label}</span>
        </div>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            bet.ev > 0
              ? 'bg-signal-positive-bg text-signal-positive'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {bet.ev > 0 ? '+' : ''}
          {bet.ev.toFixed(1)}% EV
        </span>
      </div>

      <div className="mt-4 text-lg font-medium text-foreground">{bet.selection}</div>

      {/* Stat grid */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Model probability</span>
          <span className="font-medium text-foreground tabular-nums">
            {(bet.modelProbability * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Market odds</span>
          <span className="font-medium text-foreground tabular-nums">{bet.marketOdds.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Fair odds</span>
          <span className="font-medium text-muted-foreground tabular-nums">{bet.fairOdds.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Edge</span>
          <span className="font-medium text-signal-positive tabular-nums">
            +{bet.edge.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Kelly stake</span>
          <span className="font-medium text-foreground tabular-nums">{bet.kellyStake.toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-muted-foreground">CLV projection</span>
          <span className="font-medium text-signal-positive tabular-nums">
            +{bet.clvProjection.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Line movement & historical edge */}
      <div className="mt-5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isDrifting ? (
            <TrendingUp className="h-3.5 w-3.5 text-signal-positive" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {isDrifting ? 'Odds drifting' : 'Odds tightening'}: {bet.lineMovement.opening.toFixed(2)} →{' '}
          {bet.lineMovement.current.toFixed(2)}
        </p>
        <div className="mt-3 flex items-end justify-between gap-2">
          {bet.lineMovement.points.map((p, i) => (
            <div key={p.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-medium tabular-nums text-foreground">{p.odds.toFixed(2)}</span>
              <div
                className={cn(
                  'h-1.5 w-full rounded-full',
                  i === bet.lineMovement.points.length - 1 ? 'bg-signal-positive/70' : 'bg-muted'
                )}
              />
              <span className="text-[10px] text-muted-foreground">{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-border/60 pt-4">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-base font-semibold text-foreground tabular-nums">{bet.sampleSize}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Matches</div>
          </div>
          <div>
            <div className="text-base font-semibold text-foreground tabular-nums">
              {bet.historicalWinRate.toFixed(1)}%
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Win rate</div>
          </div>
          <div>
            <div className="text-base font-semibold text-signal-positive tabular-nums">
              +{bet.historicalRoi.toFixed(1)}%
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Hist. ROI</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MatchDetailView({ matchId }: MatchDetailViewProps) {
  const matchBets = DEMO_VALUE_BETS.filter((b) => b.id === matchId);

  if (matchBets.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Match not found.</p>
        <Link
          href="/app/value-bets"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Value Bets
        </Link>
      </div>
    );
  }

  // Group all bets for this fixture (by matching teams) — expanded view shows all four markets.
  const fixtureBets = DEMO_VALUE_BETS.filter(
    (b) => b.homeTeam === matchBets[0].homeTeam && b.awayTeam === matchBets[0].awayTeam
  );
  const allFour = fixtureBets.length > 0 ? fixtureBets : matchBets;
  const reference = allFour[0];

  return (
    <div className="flex flex-col space-y-6 pb-8">
      {/* Back link */}
      <Link
        href="/app/value-bets"
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Value Bets
      </Link>

      {/* Match header — sparse */}
      <div className="border-b border-border pb-6">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {reference.competition}
          </span>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-foreground">
            {reference.homeTeam} <span className="text-muted-foreground font-normal">vs</span> {reference.awayTeam}
          </h1>
          <p className="text-sm text-muted-foreground">{formatKickoff(reference.kickoff)}</p>
        </div>
      </div>

      {/* Four market cards */}
      <div>
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Markets
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {allFour.map((bet) => (
            <MarketCard key={bet.id} bet={bet} />
          ))}
        </div>
      </div>
    </div>
  );
}