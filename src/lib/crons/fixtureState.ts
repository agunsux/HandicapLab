// EPIC 54 Stage B — Fixture Lifecycle State Machine (Extended)
// Full autonomous lifecycle:
//   DISCOVERED → HISTORICAL_READY → ENRICHMENT_PENDING → SNAPSHOT_PENDING
//   → SNAPSHOT_COMPLETE → PREDICTION_GENERATED → PRE_MATCH → LIVE
//   → HALFTIME → FULLTIME → SETTLEMENT_PENDING → SETTLED
//   → METRICS_UPDATED → ARCHIVED
//
// Every transition is atomic, idempotent, and auditable.

import { supabase } from '@/lib/supabase.server';

export type FixtureState =
  | 'DISCOVERED'
  | 'HISTORICAL_READY'
  | 'ENRICHMENT_PENDING'
  | 'SNAPSHOT_PENDING'
  | 'SNAPSHOT_COMPLETE'
  | 'PREDICTION_GENERATED'
  | 'PRE_MATCH'
  | 'LIVE'
  | 'HALFTIME'
  | 'FULLTIME'
  | 'SETTLEMENT_PENDING'
  | 'SETTLED'
  | 'METRICS_UPDATED'
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

// Valid transitions — single source of truth
const VALID_TRANSITIONS: Record<FixtureState, FixtureState[]> = {
  DISCOVERED:            ['HISTORICAL_READY', 'ENRICHMENT_PENDING'],
  HISTORICAL_READY:      ['ENRICHMENT_PENDING'],
  ENRICHMENT_PENDING:    ['SNAPSHOT_PENDING'],
  SNAPSHOT_PENDING:      ['SNAPSHOT_COMPLETE'],
  SNAPSHOT_COMPLETE:     ['PREDICTION_GENERATED'],
  PREDICTION_GENERATED:  ['PRE_MATCH'],
  PRE_MATCH:             ['LIVE'],
  LIVE:                  ['HALFTIME', 'FULLTIME'],
  HALFTIME:              ['FULLTIME'],
  FULLTIME:              ['SETTLEMENT_PENDING'],
  SETTLEMENT_PENDING:    ['SETTLED'],
  SETTLED:               ['METRICS_UPDATED'],
  METRICS_UPDATED:       ['ARCHIVED'],
  ARCHIVED:              [],
};

function isValidTransition(from: FixtureState, to: FixtureState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function stateTimestampColumn(state: FixtureState): string {
  const map: Record<string, string> = {
    DISCOVERED: 'discovered_at',
    HISTORICAL_READY: 'historical_ready_at',
    ENRICHMENT_PENDING: 'enrichment_pending_at',
    SNAPSHOT_PENDING: 'snapshot_pending_at',
    SNAPSHOT_COMPLETE: 'snapshot_complete_at',
    PREDICTION_GENERATED: 'prediction_generated_at',
    PRE_MATCH: 'pre_match_at',
    LIVE: 'live_at',
    HALFTIME: 'halftime_at',
    FULLTIME: 'fulltime_at',
    SETTLEMENT_PENDING: 'settlement_pending_at',
    SETTLED: 'settled_at',
    METRICS_UPDATED: 'metrics_updated_at',
    ARCHIVED: 'archived_at',
  };
  return map[state] ?? 'updated_at';
}

// Upsert a fixture at DISCOVERED (idempotent — preserves existing state)
export async function upsertFixture(opts: {
  fixtureId: number | string;
  leagueId: number;
  leagueName: string;
  season: number;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  leagueTier: number;
  priorityScore: number;
}): Promise<void> {
  const now = new Date().toISOString();

  await supabase.from('fixture_states').upsert({
    fixture_id: String(opts.fixtureId),
    league_id: opts.leagueId,
    league_name: opts.leagueName,
    season: opts.season,
    home_team: opts.homeTeam,
    away_team: opts.awayTeam,
    kickoff: opts.kickoff,
    league_tier: opts.leagueTier,
    priority_score: opts.priorityScore,
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
  const { data: current } = await supabase
    .from('fixture_states')
    .select('state')
    .eq('fixture_id', fixtureId)
    .single();

  if (!current) {
    console.warn(`[FixtureState] Fixture ${fixtureId} not found`);
    return false;
  }

  const currentState = current.state as FixtureState;
  if (!isValidTransition(currentState, newState)) {
    console.warn(`[FixtureState] Invalid transition: ${currentState} → ${newState} for ${fixtureId}`);
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

// Mark snapshot dependency status
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

// ─── Queries ──────────────────────────────────────────────────────────────

export async function getFixturesByState(
  states: FixtureState[],
  opts?: { limit?: number; minTier?: number }
): Promise<FixtureStateRow[]> {
  let query = supabase
    .from('fixture_states')
    .select('*')
    .in('state', states)
    .order('priority_score', { ascending: false });

  if (opts?.minTier !== undefined) void query.lte('league_tier', opts.minTier);
  if (opts?.limit !== undefined) void query.limit(opts.limit);

  const { data } = await query;
  return (data ?? []).map(mapRow);
}

// Fixtures needing snapshots (DISCOVERED / HISTORICAL_READY / ENRICHMENT_PENDING + kickoff in window)
export async function getFixturesNeedingSnapshots(windowStart: Date, windowEnd: Date): Promise<FixtureStateRow[]> {
  const { data } = await supabase
    .from('fixture_states')
    .select('*')
    .in('state', ['DISCOVERED', 'HISTORICAL_READY', 'ENRICHMENT_PENDING'])
    .gte('kickoff', windowStart.toISOString())
    .lte('kickoff', windowEnd.toISOString())
    .order('priority_score', { ascending: false });

  return (data ?? []).map(mapRow);
}

// Fixtures needing settlement (FULLTIME)
export async function getFixturesNeedingSettlement(): Promise<FixtureStateRow[]> {
  const { data } = await supabase
    .from('fixture_states')
    .select('*')
    .eq('state', 'FULLTIME')
    .order('priority_score', { ascending: false })
    .limit(50);

  return (data ?? []).map(mapRow);
}

// Fixtures needing metrics update (SETTLED)
export async function getFixturesNeedingMetricsUpdate(): Promise<FixtureStateRow[]> {
  const { data } = await supabase
    .from('fixture_states')
    .select('*')
    .eq('state', 'SETTLED')
    .order('priority_score', { ascending: false })
    .limit(50);

  return (data ?? []).map(mapRow);
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

// ─── League Import Progress ───────────────────────────────────────────────
export async function getLeagueImportProgress(): Promise<Array<{
  leagueId: number;
  leagueName: string;
  total: number;
  discovered: number;
  snapshotComplete: number;
  predicted: number;
  fulltime: number;
  settled: number;
  metricsUpdated: number;
}>> {
  const { data } = await supabase.from('fixture_states').select('league_id, league_name, state');
  if (!data) return [];

  const groups = new Map<string, any>();
  for (const row of data) {
    const key = `${row.league_id}`;
    if (!groups.has(key)) {
      groups.set(key, { leagueId: row.league_id, leagueName: row.league_name, total: 0, discovered: 0, snapshotComplete: 0, predicted: 0, fulltime: 0, settled: 0, metricsUpdated: 0 });
    }
    const g = groups.get(key)!;
    g.total += 1;
    const s = row.state as FixtureState;
    if (s === 'DISCOVERED' || s === 'HISTORICAL_READY' || s === 'ENRICHMENT_PENDING') g.discovered += 1;
    else if (s === 'SNAPSHOT_COMPLETE' || s === 'PREDICTION_GENERATED') g.snapshotComplete += 1;
    else if (s === 'PRE_MATCH') g.predicted += 1;
    else if (s === 'FULLTIME' || s === 'SETTLEMENT_PENDING') g.fulltime += 1;
    else if (s === 'SETTLED') g.settled += 1;
    else if (s === 'METRICS_UPDATED' || s === 'ARCHIVED') g.metricsUpdated += 1;
  }
  return Array.from(groups.values());
}
