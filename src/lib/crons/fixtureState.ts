// EPIC 53 — Fixture State Machine
// Single source of truth for every fixture's lifecycle.
// Scheduler reads fixture_states instead of re-discovering every run.
//
// State flow:
//   DISCOVERED → HISTORICAL_READY → SNAPSHOT_READY → PREDICTED → LIVE
//   → HALFTIME → FINISHED → SETTLED → ARCHIVED
//
// Transitions are tracked with timestamps for full audit trail.

import { supabase } from '@/lib/supabase.server';
import type { ScoredFixture } from '@/lib/crons/fixtureDiscovery';

export type FixtureState =
  | 'DISCOVERED'
  | 'HISTORICAL_READY'
  | 'SNAPSHOT_READY'
  | 'PREDICTED'
  | 'LIVE'
  | 'HALFTIME'
  | 'FINISHED'
  | 'SETTLED'
  | 'ARCHIVED';

export interface FixtureStateRow {
  id: string;
  fixtureId: string;
  leagueId: number;
  leagueName: string;
  season: number;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  state: FixtureState;
  leagueTier: number;
  priorityScore: number;
  snapshotDataGap: string[];
  oddsBudgetSpent: number;
  createdAt: string;
  updatedAt: string;
}

// Desired transitions per state
const VALID_TRANSITIONS: Record<FixtureState, FixtureState[]> = {
  DISCOVERED:        ['HISTORICAL_READY', 'SNAPSHOT_READY'],
  HISTORICAL_READY:  ['SNAPSHOT_READY'],
  SNAPSHOT_READY:    ['PREDICTED'],
  PREDICTED:         ['LIVE'],
  LIVE:              ['HALFTIME', 'FINISHED'],
  HALFTIME:          ['FINISHED'],
  FINISHED:          ['SETTLED'],
  SETTLED:           ['ARCHIVED'],
  ARCHIVED:          [],
};

function isValidTransition(from: FixtureState, to: FixtureState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function stateTimestampColumn(state: FixtureState): string {
  const map: Record<string, string> = {
    DISCOVERED: 'discovered_at',
    HISTORICAL_READY: 'historical_ready_at',
    SNAPSHOT_READY: 'snapshot_ready_at',
    PREDICTED: 'predicted_at',
    LIVE: 'live_at',
    HALFTIME: 'halftime_at',
    FINISHED: 'finished_at',
    SETTLED: 'settled_at',
    ARCHIVED: 'archived_at',
  };
  return map[state] ?? 'updated_at';
}

// Upsert a fixture into the state machine (idempotent — preserves existing state)
export async function upsertFixture(fixture: ScoredFixture): Promise<void> {
  const now = new Date().toISOString();

  await supabase.from('fixture_states').upsert({
    fixture_id: String(fixture.fixtureId),
    league_id: fixture.leagueId,
    league_name: fixture.leagueName,
    season: new Date(fixture.kickoff).getFullYear(),
    home_team: fixture.homeTeam,
    away_team: fixture.awayTeam,
    kickoff: fixture.kickoff.toISOString(),
    league_tier: fixture.leagueTier,
    priority_score: fixture.priorityScore,
    state: 'DISCOVERED',
    discovered_at: now,
    updated_at: now,
  }, { onConflict: 'fixture_id', ignoreDuplicates: true });
}

// Transition a fixture to a new state.
// Returns false if the transition is invalid.
export async function transitionState(
  fixtureId: string,
  newState: FixtureState,
  extra?: Partial<{
    priorityScore: number;
    snapshotDataGap: string[];
    oddsBudgetSpent: number;
  }>
): Promise<boolean> {
  // Fetch current state
  const { data: current } = await supabase
    .from('fixture_states')
    .select('state')
    .eq('fixture_id', fixtureId)
    .single();

  if (!current) {
    console.warn(`[FixtureState] Fixture ${fixtureId} not found in state machine`);
    return false;
  }

  const currentState = current.state as FixtureState;

  if (!isValidTransition(currentState, newState)) {
    console.warn(`[FixtureState] Invalid transition: ${currentState} → ${newState} for fixture ${fixtureId}`);
    return false;
  }

  const now = new Date().toISOString();
  const tsColumn = stateTimestampColumn(newState);

  const updates: Record<string, unknown> = {
    state: newState,
    updated_at: now,
    [tsColumn]: now,
  };

  if (extra?.priorityScore !== undefined) updates.priority_score = extra.priorityScore;
  if (extra?.snapshotDataGap !== undefined) updates.snapshot_data_gap = extra.snapshotDataGap;
  if (extra?.oddsBudgetSpent !== undefined) updates.odds_budget_spent = extra.oddsBudgetSpent;

  await supabase.from('fixture_states').update(updates).eq('fixture_id', fixtureId);
  return true;
}

// Mark snapshot dependency status for a fixture
export async function markSnapshotDependency(
  fixtureId: string,
  source: 'odds' | 'weather' | 'injuries' | 'lineups' | 'rivalry',
  status: 'ok' | 'missing' | 'error'
): Promise<void> {
  const col = `snapshot_${source}_status`;
  await supabase
    .from('fixture_states')
    .update({ [col]: status, updated_at: new Date().toISOString() })
    .eq('fixture_id', fixtureId);
}

// Query fixtures by state (for scheduler consumption)
export async function getFixturesByState(
  states: FixtureState[],
  opts?: { limit?: number; minTier?: number }
): Promise<FixtureStateRow[]> {
  let query = supabase
    .from('fixture_states')
    .select('*')
    .in('state', states)
    .order('priority_score', { ascending: false });

  if (opts?.minTier !== undefined) {
    void query.lte('league_tier', opts.minTier);
  }
  if (opts?.limit !== undefined) {
    void query.limit(opts.limit);
  }

  const { data } = await query;
  if (!data) return [];

  return data.map(mapRow);
}

// Fixtures that need snapshots (DISCOVERED + kickoff in critical window)
export async function getFixturesNeedingSnapshots(windowStart: Date, windowEnd: Date): Promise<FixtureStateRow[]> {
  const { data } = await supabase
    .from('fixture_states')
    .select('*')
    .in('state', ['DISCOVERED', 'HISTORICAL_READY'])
    .gte('kickoff', windowStart.toISOString())
    .lte('kickoff', windowEnd.toISOString())
    .order('priority_score', { ascending: false });

  if (!data) return [];
  return data.map(mapRow);
}

// Fixtures that need post-match analysis (FINISHED, not yet SETTLED/ARCHIVED)
export async function getFixturesNeedingPostMatch(): Promise<FixtureStateRow[]> {
  const { data } = await supabase
    .from('fixture_states')
    .select('*')
    .eq('state', 'FINISHED')
    .order('priority_score', { ascending: false })
    .limit(50);

  if (!data) return [];
  return data.map(mapRow);
}

function mapRow(row: Record<string, unknown>): FixtureStateRow {
  return {
    id: row.id as string,
    fixtureId: row.fixture_id as string,
    leagueId: row.league_id as number,
    leagueName: row.league_name as string,
    season: row.season as number,
    homeTeam: row.home_team as string,
    awayTeam: row.away_team as string,
    kickoff: row.kickoff as string,
    state: row.state as FixtureState,
    leagueTier: (row.league_tier as number) ?? 6,
    priorityScore: (row.priority_score as number) ?? 0,
    snapshotDataGap: (row.snapshot_data_gap as string[]) ?? [],
    oddsBudgetSpent: (row.odds_budget_spent as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Get overall import progress per league
export async function getLeagueImportProgress(): Promise<Array<{
  leagueId: number;
  leagueName: string;
  total: number;
  discovered: number;
  historicalReady: number;
  snapshotReady: number;
  predicted: number;
  finished: number;
  settled: number;
}>> {
  const { data } = await supabase
    .from('fixture_states')
    .select('league_id, league_name, state');

  if (!data) return [];

  const groups = new Map<string, {
    leagueId: number;
    leagueName: string;
    total: number;
    discovered: number;
    historicalReady: number;
    snapshotReady: number;
    predicted: number;
    finished: number;
    settled: number;
  }>();

  for (const row of data) {
    const key = `${row.league_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        leagueId: row.league_id as number,
        leagueName: row.league_name as string,
        total: 0, discovered: 0, historicalReady: 0, snapshotReady: 0, predicted: 0, finished: 0, settled: 0,
      });
    }
    const g = groups.get(key)!;
    g.total += 1;
    const state = row.state as FixtureState;
    if (state === 'DISCOVERED') g.discovered += 1;
    else if (state === 'HISTORICAL_READY') g.historicalReady += 1;
    else if (state === 'SNAPSHOT_READY') g.snapshotReady += 1;
    else if (state === 'PREDICTED') g.predicted += 1;
    else if (state === 'SETTLED') g.settled += 1;
    else if (state === 'FINISHED') g.finished += 1;
  }

  return Array.from(groups.values());
}
