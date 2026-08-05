'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Lock, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKickoff, MARKET_LABELS, MarketType, ValueBet } from '@/app/app/_data/terminal';

interface ValueBetsFeedProps {
  bets: ValueBet[];
  marketFilter?: MarketType;
}

export function ValueBetsFeed({ bets, marketFilter }: ValueBetsFeedProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = marketFilter ? bets.filter((b) => b.market === marketFilter) : bets;

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-border/70 bg-card/60 p-8 text-center text-xs text-muted-foreground">
        Engine is scanning. No validated opportunities for this window yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3">
      {filtered.map((bet) => {
        const isExpanded = expandedId === bet.id;
        const home = bet.homeTeam || bet.match?.split(' vs ')[0] || 'Home';
        const away = bet.awayTeam || bet.match?.split(' vs ')[1] || 'Away';
        const comp = bet.competition || bet.league || 'League';
        const isLocked = !!bet.locked;
        const ev = bet.ev ?? 0;
        const prob = bet.modelProb ?? bet.modelProbability ?? 0;

        return (
          <div
            key={bet.id + (bet.market || '')}
            className="group rounded-lg border border-border bg-card transition-all hover:border-border/90"
          >
            {/* Main row */}
            <div className="flex flex-col p-4 sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Teams & Kickoff */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {comp}
                  </span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {formatKickoff(bet.kickoff)}
                  </span>
                </div>
                <div className="mt-1 truncate text-sm font-semibold tracking-tight text-foreground">
                  {home} <span className="text-muted-foreground font-normal">vs</span> {away}
                </div>
              </div>

              {/* Market & Selection */}
              <div className="hidden w-32 shrink-0 md:block">
                <div className="text-xs font-medium text-foreground">{MARKET_LABELS[bet.market] || bet.market}</div>
                <div className="text-[11px] text-muted-foreground">{bet.selection}</div>
              </div>

              {/* Model probability */}
              <div className="hidden w-20 shrink-0 text-right sm:block">
                <div className="text-xs font-semibold text-foreground tabular-nums">
                  {isLocked ? <Lock className="h-3 w-3 inline text-amber-500" /> : `${(prob * 100).toFixed(1)}%`}
                </div>
                <div className="text-[10px] text-muted-foreground">Model</div>
              </div>

              {/* Market Odds */}
              <div className="hidden w-16 shrink-0 text-right sm:block">
                <div className="text-xs font-semibold text-foreground tabular-nums">
                  {isLocked ? '—' : (bet.marketOdds || 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground">Pinnacle</div>
              </div>

              {/* Fair Odds */}
              <div className="hidden w-16 shrink-0 text-right md:block">
                <div className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {isLocked ? '—' : (bet.fairOdds || 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground">Fair</div>
              </div>

              {/* EV Badge */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <div className="text-right">
                  <div
                    className={cn(
                      'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold tabular-nums',
                      isLocked
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        : ev > 0
                        ? 'bg-signal-positive-bg text-signal-positive'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isLocked ? (
                      <>
                        <Lock className="h-3 w-3" /> Pro Edge
                      </>
                    ) : (
                      <>
                        {ev > 0 ? '+' : ''}
                        {(ev * 100).toFixed(1)}% EV
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setExpandedId(isExpanded ? null : bet.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Expanded context */}
            {isExpanded && (
              <div className="border-t border-border/70 px-4 py-4">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Line movement */}
                  {bet.lineMovement && (
                    <div>
                      <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Line Movement
                      </h4>
                      <div className="flex items-end justify-between gap-2">
                        {bet.lineMovement.points.map((p: { label: string; odds: number }, i: number) => (
                          <div key={p.label} className="flex flex-1 flex-col items-center gap-1">
                            <span className="text-xs font-medium tabular-nums text-foreground">
                              {p.odds.toFixed(2)}
                            </span>
                            <div
                              className={cn(
                                'h-1.5 w-full rounded-full',
                                i === (bet.lineMovement?.points.length || 1) - 1
                                  ? 'bg-signal-positive/70'
                                  : 'bg-muted'
                              )}
                            />
                            <span className="text-[10px] text-muted-foreground">{p.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Historical performance */}
                  <div>
                    <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Historical Sub-Cohort Edge
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded bg-muted/40 p-2">
                        <div className="font-semibold text-foreground tabular-nums">{bet.sampleSize || 0}</div>
                        <div className="text-[10px] text-muted-foreground">Sample</div>
                      </div>
                      <div className="rounded bg-muted/40 p-2">
                        <div className="font-semibold text-foreground tabular-nums">
                          {(bet.historicalWinRate || 0).toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">Win Rate</div>
                      </div>
                      <div className="rounded bg-muted/40 p-2">
                        <div className="font-semibold text-signal-positive tabular-nums">
                          +{(bet.historicalRoi || 0).toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">ROI</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
                  <div>Model: {bet.modelVersion || 'Prematch v1.0'} · Ground Truth: Pinnacle</div>
                  <Link
                    href={`/app/matches/${bet.id}`}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Deep breakdown <ExternalLink className="h-3 w-3" />
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