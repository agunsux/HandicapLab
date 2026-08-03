'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ValueBet, MARKET_LABELS, formatKickoff } from '@/app/app/_data/terminal';

interface ValueBetsFeedProps {
  bets: ValueBet[];
  marketFilter?: ValueBet['market'] | 'all';
  searchQuery?: string;
}

export function ValueBetsFeed({ bets, marketFilter = 'all', searchQuery = '' }: ValueBetsFeedProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = bets.filter((b) => {
    if (marketFilter !== 'all' && b.market !== marketFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const haystack = `${b.homeTeam} ${b.awayTeam} ${b.competition} ${b.selection}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No value opportunities match the current filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((bet) => {
        const isExpanded = expandedId === bet.id;
        const movement = bet.lineMovement.current - bet.lineMovement.opening;
        const isDrifting = movement > 0;

        return (
          <div
            key={bet.id}
            className={cn(
              'rounded-lg border bg-card transition-colors',
              isExpanded ? 'border-border shadow-elevation-1' : 'border-border/70 hover:border-border'
            )}
          >
            {/* Row header (clickable to expand) */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : bet.id)}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-left"
              aria-expanded={isExpanded}
            >
              {/* Match info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-medium text-foreground">
                    {bet.homeTeam} <span className="text-muted-foreground font-normal">vs</span> {bet.awayTeam}
                  </h3>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {bet.competition}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatKickoff(bet.kickoff)}</p>
              </div>

              {/* Market */}
              <div className="hidden w-32 shrink-0 md:block">
                <div className="text-xs font-medium text-foreground">{MARKET_LABELS[bet.market]}</div>
                <div className="text-[11px] text-muted-foreground">{bet.selection}</div>
              </div>

              {/* Model probability */}
              <div className="hidden w-20 shrink-0 text-right sm:block">
                <div className="text-xs font-semibold text-foreground">
                  {(bet.modelProbability * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Model</div>
              </div>

              {/* Market odds */}
              <div className="hidden w-20 shrink-0 text-right sm:block">
                <div className="text-xs font-semibold text-foreground">{bet.marketOdds.toFixed(2)}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Odds</div>
              </div>

              {/* Fair odds */}
              <div className="hidden w-20 shrink-0 text-right lg:block">
                <div className="text-xs font-semibold text-muted-foreground">{bet.fairOdds.toFixed(2)}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fair</div>
              </div>

              {/* EV — highlighted in soft green when positive */}
              <div className="w-20 shrink-0 text-right">
                <div
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    bet.ev > 0 ? 'text-signal-positive' : 'text-muted-foreground'
                  )}
                >
                  {bet.ev > 0 ? '+' : ''}
                  {bet.ev.toFixed(1)}%
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">EV</div>
              </div>

              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                  isExpanded && 'rotate-180'
                )}
              />
            </button>

            {/* Expanded context: line movement + historical edge */}
            {isExpanded && (
              <div className="border-t border-border/70 px-4 py-4">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Line movement summary */}
                  <div>
                    <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Line Movement
                    </h4>
                    <div className="flex items-end justify-between gap-2">
                      {bet.lineMovement.points.map((p, i) => (
                        <div key={p.label} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-xs font-medium tabular-nums text-foreground">
                            {p.odds.toFixed(2)}
                          </span>
                          <div
                            className={cn(
                              'h-1.5 w-full rounded-full',
                              i === bet.lineMovement.points.length - 1
                                ? 'bg-signal-positive/70'
                                : 'bg-muted'
                            )}
                          />
                          <span className="text-[10px] text-muted-foreground">{p.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {isDrifting ? (
                        <TrendingUp className="h-3.5 w-3.5 text-signal-positive" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {isDrifting ? 'Odds drifting' : 'Odds tightening'} — opening{' '}
                      {bet.lineMovement.opening.toFixed(2)} → current {bet.lineMovement.current.toFixed(2)}
                    </p>
                  </div>

                  {/* Historical edge */}
                  <div>
                    <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Historical Edge
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-lg font-semibold tabular-nums text-foreground">
                          {bet.sampleSize}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Matches
                        </div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold tabular-nums text-foreground">
                          {bet.historicalWinRate.toFixed(1)}%
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Win Rate
                        </div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold tabular-nums text-signal-positive">
                          +{bet.historicalRoi.toFixed(1)}%
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          ROI
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{bet.driver}</p>
                  </div>
                </div>

                {/* Drill down */}
                <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {bet.modelVersion} · Brier {bet.brier.toFixed(3)} · CLV proj +{bet.clvProjection.toFixed(1)}%
                  </span>
                  <Link
                    href={`/app/matches/${bet.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Full analysis <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}