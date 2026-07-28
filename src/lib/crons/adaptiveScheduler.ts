// EPIC 56 — Adaptive League Scheduler
// Computes efficiency scores and selects which leagues get active quota each day.
//
// Algorithm:
//   EfficiencyScore = raw_contribution / api_cost
//   raw_contribution = (ROI_norm × 0.25) + (CLV_norm × 0.20) + (Brier_quality × 0.20)
//                     + (WinRate_norm × 0.15) + (Confidence_norm × 0.10) + (Volume_norm × 0.10)
//
//   Daily selection:
//     1. Always include: leagues with fixtures in T-60 window (critical)
//     2. Always include: leagues with fixtures settling today
//     3. Sort remaining by adaptive_priority = efficiencyScore × seasonStatus × fixtureVolume
//     4. Allocate quota from highest priority down until daily budget consumed
//
// Static priority tiers are REMOVED — everything is dynamic.

import { supabase } from '@/lib/supabase.server';

import { getProviderHealth, type ProviderHealth } from '@/lib/providers/quotaManager';

export interface LeagueEfficiency {
  leagueId: number;
  leagueName: string;
  roi: number;
  clv: number;
  brierScore: number;
  winRate: number;
  predictionCount: number;
  apiRequestsUsed: number;
  avgFixturesPerWeek: number;
  avgConfidence: number;
  rawEfficiency: number;
  seasonStatus: 'active' | 'off_season' | 'unknown';
  fixtureVolume7d: number;
  adaptivePriority: number;
}

export interface AllocationPlan {
  activeLeagues: LeagueEfficiency[];
  skippedLeagues: LeagueEfficiency[];
  totalQuotaNeeded: number;
  remainingQuotaAfterPlan: number;
  mode: 'NORMAL' | 'ECONOMY' | 'CRITICAL';
}

// ─── Efficiency Score Computation ────────────────────────────────────

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// Brier quality: 0 = perfect, 0.25 = random, >0.5 = bad. Invert so higher = better.
function brierQuality(brier: number): number {
  return Math.max(0, 1 - (brier / 0.25));
}

function computeRawEfficiency(m: LeagueEfficiency): number {
  const roiContrib = normalize(m.roi, -0.5, 0.5) * 0.25;
  const clvContrib = normalize(m.clv, -0.1, 0.1) * 0.20;
  const brierContrib = brierQuality(m.brierScore) * 0.20;
  const winRateContrib = normalize(m.winRate, 0, 1) * 0.15;
  const confContrib = normalize(m.avgConfidence, 0, 1) * 0.10;
  const volumeContrib = normalize(m.avgFixturesPerWeek, 0, 20) * 0.10;

  const totalContrib = roiContrib + clvContrib + brierContrib + winRateContrib + confContrib + volumeContrib;

  // Divide by API cost per prediction (min 1 to avoid division by zero)
  const apiCost = Math.max(1, m.apiRequestsUsed);
  const costEfficiency = m.predictionCount > 0 ? totalContrib / apiCost : totalContrib * 0.01;

  return Math.round(costEfficiency * 1000000) / 1000000;
}

function computeSeasonStatus(volume7d: number, fixtures3d: number, fixtures1d: number): 'active' | 'off_season' | 'unknown' {
  if (fixtures1d > 0) return 'active';
  if (fixtures3d > 3) return 'active';
  if (volume7d > 0) return 'active';
  if (volume7d === 0 && fixtures3d === 0 && fixtures1d === 0) return 'off_season';
  return 'unknown';
}

function computeAdaptivePriority(efficiency: LeagueEfficiency): number {
  const base = efficiency.rawEfficiency * 1000;

  // Season status multiplier
  let seasonMult = 1.0;
  if (efficiency.seasonStatus === 'active') seasonMult = 1.5;
  else if (efficiency.seasonStatus === 'off_season') seasonMult = 0.3;

  // Volume boost: leagues with many fixtures get a small bonus (network effect)
  const volumeBoost = Math.min(2.0, 1.0 + (efficiency.fixtureVolume7d / 50) * 0.5);

  // Confidence boost: leagues with more predictions have more reliable scores
  const sampleBoost = Math.min(1.5, 1.0 + Math.log10(Math.max(1, efficiency.predictionCount)) * 0.1);

  const adaptive = base * seasonMult * volumeBoost * sampleBoost;
  return Math.round(adaptive * 1000000) / 1000000;
}

// ─── Data Access ─────────────────────────────────────────────────────

export async function loadAllLeagueEfficiency(): Promise<LeagueEfficiency[]> {
  const { data } = await supabase.from('league_efficiency').select('*');
  if (!data || data.length === 0) {
    // Fallback: seed from league_evolution or static config
    return seedFromConfig();
  }

  const mapped: LeagueEfficiency[] = data.map((r: any) => ({
    leagueId: r.league_id,
    leagueName: r.league_name,
    roi: parseFloat(r.roi ?? '0'),
    clv: parseFloat(r.clv ?? '0'),
    brierScore: parseFloat(r.brier_score ?? '0.5'),
    winRate: parseFloat(r.win_rate ?? '0'),
    predictionCount: r.prediction_count ?? 0,
    apiRequestsUsed: r.api_requests_used ?? 0,
    avgFixturesPerWeek: parseFloat(r.avg_fixtures_per_week ?? '0'),
    avgConfidence: parseFloat(r.avg_confidence ?? '0'),
    rawEfficiency: parseFloat(r.raw_efficiency ?? '0'),
    seasonStatus: r.season_status ?? 'unknown',
    fixtureVolume7d: r.fixture_volume_7d ?? 0,
    adaptivePriority: parseFloat(r.adaptive_priority ?? '0'),
  }));

  return mapped;
}

async function seedFromConfig(): Promise<LeagueEfficiency[]> {
  const seeds = [
    { id: 39, name: 'Premier League' },
    { id: 140, name: 'La Liga' },
    { id: 135, name: 'Serie A' },
    { id: 78, name: 'Bundesliga' },
    { id: 61, name: 'Ligue 1' }
  ];

  const entries: LeagueEfficiency[] = seeds.map((l) => ({
    leagueId: l.id,
    leagueName: l.name,
    roi: 0,
    clv: 0,
    brierScore: 0.5,
    winRate: 0,
    predictionCount: 0,
    apiRequestsUsed: 0,
    avgFixturesPerWeek: 0,
    avgConfidence: 0,
    rawEfficiency: 0.001,
    seasonStatus: 'unknown',
    fixtureVolume7d: 0,
    adaptivePriority: 0.001 * 1000 * 0.3, // off-season baseline
  }));

  // Insert into DB for persistence
  for (const e of entries) {
    await supabase.from('league_efficiency').upsert({
      league_id: e.leagueId,
      league_name: e.leagueName,
      raw_efficiency: e.rawEfficiency,
      adaptive_priority: e.adaptivePriority,
    }, { onConflict: 'league_id', ignoreDuplicates: true });
  }

  return entries;
}

// ─── Daily Allocation Engine ─────────────────────────────────────────

export async function computeAllocation(
  remainingQuota: number,
  quotaLimit: number
): Promise<AllocationPlan> {
  const leagues = await loadAllLeagueEfficiency();
  const pct = (remainingQuota / Math.max(1, quotaLimit)) * 100;

  let mode: 'NORMAL' | 'ECONOMY' | 'CRITICAL' = 'NORMAL';
  if (pct <= 10) mode = 'CRITICAL';
  else if (pct <= 40) mode = 'ECONOMY';

  // Recompute adaptive priorities
  for (const league of leagues) {
    league.adaptivePriority = computeAdaptivePriority(league);
  }

  // Sort by adaptive priority descending
  leagues.sort((a, b) => b.adaptivePriority - a.adaptivePriority);

  const activeLeagues: LeagueEfficiency[] = [];
  const skippedLeagues: LeagueEfficiency[] = [];

  // Each active league needs ~2 API calls per scheduler run (fixtures + odds)
  const costPerActiveLeague = mode === 'CRITICAL' ? 1 : 2;

  let budgetRemaining = remainingQuota;
  let totalNeeded = 0;

  for (const league of leagues) {
    // Always include if in CRITICAL mode and has live fixtures
    if (mode === 'CRITICAL' && league.fixtureVolume7d === 0) {
      skippedLeagues.push(league);
      continue;
    }

    // In ECONOMY mode, skip off-season leagues entirely
    if (mode === 'ECONOMY' && league.seasonStatus === 'off_season') {
      skippedLeagues.push(league);
      continue;
    }

    // Off-season leagues need 1 API call at most (status check)
    const cost = league.seasonStatus === 'off_season' ? 1 : costPerActiveLeague;

    if (budgetRemaining >= cost) {
      activeLeagues.push(league);
      budgetRemaining -= cost;
      totalNeeded += cost;
    } else {
      skippedLeagues.push(league);
    }
  }

  // Persist updated adaptive priorities and season status
  for (const league of [...activeLeagues, ...skippedLeagues]) {
    await supabase.from('league_efficiency').update({
      adaptive_priority: league.adaptivePriority,
      season_status: league.seasonStatus,
      raw_efficiency: league.rawEfficiency,
      updated_at: new Date().toISOString(),
    }).eq('league_id', league.leagueId);
  }

  return {
    activeLeagues,
    skippedLeagues,
    totalQuotaNeeded: totalNeeded,
    remainingQuotaAfterPlan: budgetRemaining,
    mode,
  };
}

// ─── Update efficiency after each prediction/settlement cycle ────────

export async function updateLeagueEfficiency(
  leagueId: number,
  leagueName: string,
  metrics: {
    roi?: number;
    clv?: number;
    brierScore?: number;
    winRate?: number;
    predictionCount?: number;
    apiRequestsUsed?: number;
    avgConfidence?: number;
  }
): Promise<void> {
  const { data: existing } = await supabase
    .from('league_efficiency')
    .select('*')
    .eq('league_id', leagueId)
    .single();

  const current = existing as Record<string, unknown> | null;

  const updated = {
    roi: metrics.roi ?? parseFloat((current?.roi as string) ?? '0'),
    clv: metrics.clv ?? parseFloat((current?.clv as string) ?? '0'),
    brier_score: metrics.brierScore ?? parseFloat((current?.brier_score as string) ?? '0.5'),
    win_rate: metrics.winRate ?? parseFloat((current?.win_rate as string) ?? '0'),
    prediction_count: metrics.predictionCount ?? (current?.prediction_count as number) ?? 0,
    api_requests_used: metrics.apiRequestsUsed ?? (current?.api_requests_used as number) ?? 0,
    avg_confidence: metrics.avgConfidence ?? parseFloat((current?.avg_confidence as string) ?? '0'),
    last_active_date: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
  };

  await supabase.from('league_efficiency').upsert({
    league_id: leagueId,
    league_name: leagueName,
    ...updated,
  }, { onConflict: 'league_id' });
}

// ─── Fixture volume estimation ──────────────────────────────────────

export async function updateFixtureVolumes(): Promise<void> {
  const now = new Date();
  const in1d = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
  const in3d = new Date(now.getTime() + 72 * 60 * 60_000).toISOString();
  const in7d = new Date(now.getTime() + 168 * 60 * 60_000).toISOString();

  const { data: fixtures } = await supabase
    .from('fixture_states')
    .select('league_id, kickoff')
    .gte('kickoff', now.toISOString())
    .lte('kickoff', in7d);

  if (!fixtures) return;

  const counts = new Map<number, { d1: number; d3: number; d7: number }>();

  for (const f of fixtures) {
    if (!counts.has(f.league_id)) {
      counts.set(f.league_id, { d1: 0, d3: 0, d7: 0 });
    }
    const c = counts.get(f.league_id)!;
    const ko = f.kickoff as string;
    c.d7 += 1;
    if (ko <= in3d) c.d3 += 1;
    if (ko <= in1d) c.d1 += 1;
  }

  for (const [leagueId, c] of counts) {
    await supabase.from('league_efficiency').update({
      fixtures_next_1d: c.d1,
      fixtures_next_3d: c.d3,
      fixtures_next_7d: c.d7,
      fixture_volume_7d: c.d7,
      avg_fixtures_per_week: c.d7,
      season_status: computeSeasonStatus(c.d7, c.d3, c.d1),
      updated_at: new Date().toISOString(),
    }).eq('league_id', leagueId);
  }
}
