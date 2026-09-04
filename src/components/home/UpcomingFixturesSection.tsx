'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Clock, MapPin, ArrowRight, ShieldCheck, Filter } from 'lucide-react';
import type { PublicUpcomingFixture } from '@/lib/services/upcomingFixturesService';

interface UpcomingFixturesSectionProps {
  initialFixtures: PublicUpcomingFixture[];
  totalAvailable: number;
}

export function UpcomingFixturesSection({
  initialFixtures,
  totalAvailable,
}: UpcomingFixturesSectionProps) {
  const [windowFilter, setWindowFilter] = useState<'today' | 'tomorrow' | '3days' | '7days'>('today');
  const [fixtures, setFixtures] = useState<PublicUpcomingFixture[]>(initialFixtures);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  const handleFilterChange = (w: 'today' | 'tomorrow' | '3days' | '7days') => {
    setWindowFilter(w);
    setLoading(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/public/fixtures/upcoming?window=${w}&limit=12`);
        if (res.ok) {
          const data = await res.json();
          setFixtures(data.fixtures || []);
        }
      } catch (err) {
        console.error('Failed to fetch filtered fixtures:', err);
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <section id="upcoming-matches" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981] mb-2">
            <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            LIVE FIXTURE FEED &bull; API-FOOTBALL VERIFIED
          </div>
          <h2 className="text-2xl sm:text-4xl font-display font-black text-white tracking-tight">
            Upcoming Fixtures
          </h2>
          <p className="text-sm text-[#9CA3AF] mt-1 max-w-xl">
            Upcoming matches available for HandicapLab market analysis across 30 global target leagues.
          </p>
        </div>

        {/* Time Window Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#111827] rounded-xl border border-[#1F2937] self-start md:self-auto overflow-x-auto">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'tomorrow', label: 'Tomorrow' },
              { id: '3days', label: 'Next 3 Days' },
              { id: '7days', label: 'Next 7 Days' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => handleFilterChange(t.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all whitespace-nowrap ${
                windowFilter === t.id
                  ? 'bg-[#10B981] text-black font-bold shadow-sm'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fixtures Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-5 rounded-2xl bg-[#111827]/40 border border-[#1F2937] animate-pulse space-y-4">
              <div className="h-4 w-28 bg-[#1F2937] rounded" />
              <div className="h-6 w-full bg-[#1F2937] rounded" />
              <div className="h-10 w-full bg-[#1F2937]/50 rounded" />
            </div>
          ))}
        </div>
      ) : fixtures.length === 0 ? (
        <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/30 p-12 text-center">
          <Calendar className="h-10 w-10 text-[#9CA3AF]/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white font-mono">
            No upcoming fixtures available right now.
          </h3>
          <p className="text-xs text-[#9CA3AF] mt-2 max-w-md mx-auto leading-relaxed">
            Data will appear automatically when the fixture feed is updated for this time window.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {fixtures.map((fixture) => {
            const dateDisplay = new Date(fixture.kickoff).toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            });

            return (
              <div
                key={fixture.id}
                className="group p-5 rounded-2xl bg-[#111827]/70 border border-[#1F2937] hover:border-[#10B981]/50 transition-all flex flex-col justify-between shadow-sm"
              >
                <div>
                  {/* Top Bar: League & Kickoff */}
                  <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[#1F2937] text-xs font-mono text-[#9CA3AF]">
                    <div className="flex items-center gap-2 truncate">
                      {fixture.leagueLogo && (
                        <img
                          src={fixture.leagueLogo}
                          alt={fixture.leagueName}
                          className="h-4 w-4 object-contain rounded-sm"
                          loading="lazy"
                        />
                      )}
                      <span className="font-bold text-neutral-300 truncate">
                        {fixture.leagueName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#10B981] whitespace-nowrap font-bold">
                      <Clock className="h-3 w-3" />
                      <span>{fixture.kickoffTime} UTC</span>
                    </div>
                  </div>

                  {/* Date & Venue */}
                  <div className="flex items-center justify-between text-[11px] text-[#6B7280] font-mono py-2">
                    <span>{dateDisplay}</span>
                    {fixture.venue && (
                      <span className="truncate max-w-[160px] flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                        <span className="truncate">{fixture.venue}</span>
                      </span>
                    )}
                  </div>

                  {/* Teams */}
                  <div className="py-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 truncate">
                        {fixture.homeLogo ? (
                          <img
                            src={fixture.homeLogo}
                            alt={fixture.homeTeam}
                            className="h-5 w-5 object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-[#1F2937]" />
                        )}
                        <span className="text-sm font-bold text-white truncate">
                          {fixture.homeTeam}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-[#6B7280]">Home</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 truncate">
                        {fixture.awayLogo ? (
                          <img
                            src={fixture.awayLogo}
                            alt={fixture.awayTeam}
                            className="h-5 w-5 object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-[#1F2937]" />
                        )}
                        <span className="text-sm font-bold text-white truncate">
                          {fixture.awayTeam}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-[#6B7280]">Away</span>
                    </div>
                  </div>

                  {/* Markets Available */}
                  <div className="mt-2 pt-3 border-t border-[#1F2937]/80">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF] mb-2">
                      HandicapLab Coverage
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
                      <div className="p-1.5 rounded-lg bg-[#0B0F0E] border border-[#1F2937]">
                        <div className="text-[#9CA3AF] text-[9px]">AH</div>
                        <div className="text-[#10B981] font-bold text-[10px]">
                          {fixture.markets.asianHandicap.line != null
                            ? `${fixture.markets.asianHandicap.line > 0 ? '+' : ''}${fixture.markets.asianHandicap.line}`
                            : 'Active'}
                        </div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-[#0B0F0E] border border-[#1F2937]">
                        <div className="text-[#9CA3AF] text-[9px]">O/U</div>
                        <div className="text-[#10B981] font-bold text-[10px]">
                          {fixture.markets.overUnder.line != null
                            ? fixture.markets.overUnder.line
                            : 'Active'}
                        </div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-[#0B0F0E] border border-[#1F2937]">
                        <div className="text-[#9CA3AF] text-[9px]">BTTS</div>
                        <div className="text-[#10B981] font-bold text-[10px]">Active</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer status / odds notice */}
                <div className="mt-4 pt-3 border-t border-[#1F2937] flex items-center justify-between text-[11px] font-mono text-[#9CA3AF]">
                  <span className="text-neutral-400">
                    {fixture.markets.asianHandicap.homeOdds
                      ? `Odds: ${fixture.markets.asianHandicap.homeOdds.toFixed(2)}`
                      : 'Odds unavailable'}
                  </span>
                  <Link
                    href={`/asian-handicap`}
                    className="text-[#10B981] hover:underline flex items-center gap-1 font-semibold"
                  >
                    Analyze <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-[#111827]/40 border border-[#1F2937] text-xs font-mono">
        <div className="text-[#9CA3AF]">
          Showing <span className="text-white font-bold">{fixtures.length}</span> of{' '}
          <span className="text-white font-bold">{totalAvailable}</span> verified upcoming fixtures across 30 leagues.
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/asian-handicap"
            className="text-[#10B981] hover:underline flex items-center gap-1 font-bold"
          >
            Explore Asian Handicap Markets &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
