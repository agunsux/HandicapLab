// EPIC 56 — Dynamic League Registry
// Auto-discovers leagues from API-Football provider.
// New leagues are automatically recognized, registered, and prioritized.
// No code changes needed to add a league — just sync from provider.
//
// Flow:
//   1. Sync: fetch available leagues from API-Football
//   2. Register: add unknown leagues to league_efficiency with default scores
//   3. Prioritize: compute adaptive priority based on fixture volume + efficiency
//   4. Activate: scheduler picks active leagues based on quota

import { supabase } from '@/lib/supabase.server';
import { acquire, logCall } from '@/lib/providers/quotaManager';
import { LEAGUE_PRIORITIES, type LeaguePriority } from '@/lib/config/leaguePriorities';

export interface ProviderLeague {
  id: number;
  name: string;
  country: string;
  type: 'league' | 'cup';
  season: number;
  logo?: string;
}

// Top-tier leagues that get priority (tier 1-2 from static config)
const KNOWN_HIGH_PRIORITY = new Set(LEAGUE_PRIORITIES.map((l) => l.apiFootballId));

// Sync leagues from API-Football provider.
// Called when discovery quota permits.
export async function syncLeaguesFromProvider(): Promise<{
  registered: number;
  total: number;
}> {
  const receipt = await acquire('apifootball', 'fixtures', 40);
  if (!receipt.ok) {
    console.warn(`[LeagueRegistry] Sync skipped: ${receipt.reason}`);
    return { registered: 0, total: 0 };
  }

  try {
    // API-Football leagues endpoint returns all available leagues
    const response = await fetch(
      'https://v3.football.api-sports.io/leagues',
      {
        headers: {
          'x-apisports-key': process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '',
        },
      }
    );

    const data = await response.json();
    const leagues: ProviderLeague[] = (data.response ?? [])
      .filter((l: any) => l.league?.type === 'league') // Only leagues, not cups
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
      // Check if already registered
      const { data: existing } = await supabase
        .from('league_efficiency')
        .select('id')
        .eq('league_id', league.id)
        .maybeSingle();

      if (existing) continue;

      // Register new league with default efficiency
      const isHighPriority = KNOWN_HIGH_PRIORITY.has(league.id);
      const defaultSeasonStatus = 'unknown';

      await supabase.from('league_efficiency').insert({
        league_id: league.id,
        league_name: league.name,
        raw_efficiency: isHighPriority ? 0.01 : 0.001,
        adaptive_priority: isHighPriority ? 0.5 : 0.05,
        season_status: defaultSeasonStatus,
        last_active_date: null,
      });

      registered += 1;
      console.log(`[LeagueRegistry] Registered new league: ${league.name} (${league.id})`);
    }

    return { registered, total: leagues.length };
  } catch (err) {
    console.error('[LeagueRegistry] Sync failed:', err);
    return { registered: 0, total: 0 };
  }
}

// Get active leagues from the registry (not from static config)
// Returns up to `limit` leagues sorted by adaptive priority
export async function getActiveLeagues(limit?: number): Promise<LeaguePriority[]> {
  const { data } = await supabase
    .from('league_efficiency')
    .select('*')
    .order('adaptive_priority', { ascending: false });

  if (!data || data.length === 0) {
    // Fallback to static config during initial ramp-up
    return LEAGUE_PRIORITIES;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const season = now.getMonth() >= 7 ? currentYear : currentYear - 1; // Aug+ = new season

  let active: LeaguePriority[] = data.map((r: any) => ({
    apiFootballId: r.league_id,
    name: r.league_name,
    country: '', // populated by sync if needed
    tier: Math.max(1, Math.min(6, Math.round(6 - (parseFloat(r.adaptive_priority ?? '0') * 5)))),
    season,
    varSeason: 2020, // conservative default
  }));

  if (limit && limit > 0) {
    active = active.slice(0, limit);
  }

  return active;
}

// Get total known league count
export async function getLeagueCount(): Promise<number> {
  const { count } = await supabase
    .from('league_efficiency')
    .select('id', { count: 'exact', head: true });
  return count ?? 0;
}
