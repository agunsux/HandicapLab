// EPIC 56 — Dynamic League Registry
// Auto-discovers leagues from API-Football provider.
// New leagues are automatically recognized, registered, and prioritized.
// No code changes needed to add a league — just sync from provider.

import { supabase } from '@/lib/supabase.server';
import { acquire, logCall } from '@/lib/providers/quotaManager';
import { apiFootballClient } from '@/lib/apis/apifootball';

export interface LeaguePriority {
  apiFootballId: number;
  name: string;
  country: string;
  tier: number;
  season: number;
  varSeason?: number;
}

export interface ProviderLeague {
  id: number;
  name: string;
  country: string;
  type: 'league' | 'cup';
  season: number;
  logo?: string;
}

const KNOWN_HIGH_PRIORITY = new Set([39, 140, 135, 78, 61, 2]);

export async function syncLeaguesFromProvider(): Promise<{
  registered: number;
  total: number;
}> {
  const receipt = await acquire('apifootball', 'leagues', 40);
  if (!receipt.ok) {
    console.warn(`[LeagueRegistry] Sync skipped: ${receipt.reason}`);
    return { registered: 0, total: 0 };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(
      'https://v3.football.api-sports.io/leagues',
      {
        headers: {
          'x-apisports-key': process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[LeagueRegistry] Provider returned ${response.status}`);
      return { registered: 0, total: 0 };
    }

    const data = await response.json();
    const leagues: ProviderLeague[] = (data.response ?? [])
      .filter((l: any) => l.league?.type === 'league')
      .map((l: any) => ({
        id: l.league?.id,
        name: l.league?.name,
        country: l.country?.name ?? 'Unknown',
        type: l.league?.type ?? 'league',
        season: l.seasons?.[0]?.year ?? new Date().getFullYear(),
        logo: l.league?.logo,
      }));

    await logCall('apifootball', 'leagues', 0, response.status, { count: leagues.length });

    let registered = 0;
    for (const league of leagues) {
      const { data: existing } = await supabase
        .from('league_efficiency')
        .select('id')
        .eq('league_id', league.id)
        .maybeSingle();

      if (existing) continue;

      const isHighPriority = KNOWN_HIGH_PRIORITY.has(league.id);
      await supabase.from('league_efficiency').insert({
        league_id: league.id,
        league_name: league.name,
        raw_efficiency: isHighPriority ? 0.01 : 0.001,
        adaptive_priority: isHighPriority ? 0.5 : 0.05,
        season_status: 'unknown',
        last_active_date: null,
      });

      registered += 1;
      console.log(`[LeagueRegistry] Registered: ${league.name} (${league.id})`);
    }

    return { registered, total: leagues.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[LeagueRegistry] Sync failed: ${message}`);
    return { registered: 0, total: 0 };
  }
}

export async function getActiveLeagues(limit?: number): Promise<LeaguePriority[]> {
  const { data } = await supabase
    .from('league_efficiency')
    .select('*')
    .order('adaptive_priority', { ascending: false });

  if (!data || data.length === 0) {
    // Fallback during initial ramp-up
    return [];
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const season = now.getMonth() >= 7 ? currentYear : currentYear - 1;

  let active: LeaguePriority[] = data.map((r: any) => ({
    apiFootballId: r.league_id,
    name: r.league_name,
    country: '',
    tier: Math.max(1, Math.min(6, Math.round(6 - (parseFloat(r.adaptive_priority ?? '0') * 5)))),
    season,
    varSeason: r.historical_start_season ?? 2020,
  }));

  if (limit && limit > 0) active = active.slice(0, limit);
  return active;
}

export async function getLeagueCount(): Promise<number> {
  const { count } = await supabase
    .from('league_efficiency')
    .select('id', { count: 'exact', head: true });
  return count ?? 0;
}
