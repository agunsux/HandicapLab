'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Scale, LineChart, Trophy, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEMO_VALUE_BETS, formatKickoff, ValueBet } from '@/app/app/_data/terminal';

interface MatchDetailViewProps {
  matchId: string;
}

const MARKET_META: Record<string, { icon: React.ElementType; label: string }> = {
  asian_handicap: { icon: Scale, label: 'Asian Handicap' },
  over_under: { icon: LineChart, label: 'Over / Under' },
  btts: { icon: CircleDot, label: 'BTTS' },
  AH: { icon: Scale, label: 'Asian Handicap' },
  OU: { icon: LineChart, label: 'Over / Under' },
  BTTS: { icon: CircleDot, label: 'BTTS' },
};

function MarketCard({ bet }: { bet: ValueBet }) {
  const Meta = MARKET_META[bet.market] || MARKET_META.AH || MARKET_META.asian_handicap;
  const movement = (bet.lineMovement?.current || 0) - (bet.lineMovement?.opening || 0);
  const isDrifting = movement > 0;
  const ev = bet.ev ?? 0;

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
            ev > 0
              ? 'bg-signal-positive-bg text-signal-positive'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {ev > 0 ? '+' : ''}
          {ev.toFixed(1)}% EV
        </span>
      </div>

      <div className="mt-4 text-lg font-medium text-foreground">{bet.selection}</div>

      {/* Stat grid */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Model probability</span>
          <span className="font-medium text-foreground tabular-nums">
            {(((bet.modelProb || bet.modelProbability || 0)) * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Market odds</span>
          <span className="font-medium text-foreground tabular-nums">{(bet.marketOdds || 0).toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Fair odds</span>
          <span className="font-medium text-muted-foreground tabular-nums">{(bet.fairOdds || 0).toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Edge</span>
          <span className="font-medium text-signal-positive tabular-nums">
            +{(bet.edge || 0).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Kelly stake</span>
          <span className="font-medium text-foreground tabular-nums">{(bet.kellyStake || 0).toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-muted-foreground">CLV projection</span>
          <span className="font-medium text-signal-positive tabular-nums">
            +{(bet.clvProjection || 0).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Line movement */}
      {bet.lineMovement && (
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
            {bet.lineMovement.points.map((p: { label: string; odds: number }, i: number) => (
              <div key={p.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-medium tabular-nums text-foreground">{p.odds.toFixed(2)}</span>
                <div
                  className={cn(
                    'h-1.5 w-full rounded-full',
                    i === (bet.lineMovement?.points.length || 1) - 1 ? 'bg-signal-positive/70' : 'bg-muted'
                  )}
                />
                <span className="text-[10px] text-muted-foreground">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-border/60 pt-4">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-base font-semibold text-foreground tabular-nums">{bet.sampleSize || 0}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Matches</div>
          </div>
          <div>
            <div className="text-base font-semibold text-foreground tabular-nums">
              {(bet.historicalWinRate || 0).toFixed(1)}%
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Win rate</div>
          </div>
          <div>
            <div className="text-base font-semibold text-signal-positive tabular-nums">
              +{(bet.historicalRoi || 0).toFixed(1)}%
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Hist. ROI</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MatchDetailView({ matchId }: MatchDetailViewProps) {
  const bets = DEMO_VALUE_BETS.filter((b) => b.id === matchId);
  const first = bets[0] || {
    id: matchId,
    homeTeam: 'Home',
    awayTeam: 'Away',
    match: 'Match Detail',
    competition: 'League',
    league: 'League',
    kickoff: new Date().toISOString(),
  };

  return (
    <div className="flex flex-col space-y-6 pb-8">
      <Link
        href="/app/value-bets"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Value Bets
      </Link>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{first.competition || first.league}</div>
        <h1 className="mt-1 text-2xl font-display font-semibold tracking-tight text-foreground">
          {first.homeTeam || first.match?.split(' vs ')[0]} vs {first.awayTeam || first.match?.split(' vs ')[1]}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground font-mono">
          Kickoff: {formatKickoff(first.kickoff)} · Match ID: {matchId}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {bets.length === 0 ? (
          <div className="col-span-2 rounded-lg border border-border/70 bg-card p-8 text-center text-sm text-muted-foreground">
            Engine is scanning. No validated opportunities for this match window yet.
          </div>
        ) : (
          bets.map((b) => <MarketCard key={b.id + b.market} bet={b} />)
        )}
      </div>
    </div>
  );
}