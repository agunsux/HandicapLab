// EPIC 54 Stage G — League Evolution Engine
// Every league maintains its own operational profile and certification.
// Progress: research → historical_imported → calibrated → building_track_record → verified
// Certification per league is independent — no league depends on another.

import { supabase } from '@/lib/supabase.server';
import { recordAuditEvent } from '@/lib/crons/auditTrail';

export type CertificationLevel = 'research' | 'historical_imported' | 'calibrated' | 'building_track_record' | 'verified';

export interface LeagueProfile {
  leagueId: number;
  leagueName: string;
  season: number;
  certification: CertificationLevel;
  historicalCoveragePct: number;
  predictionCount: number;
  settledMatches: number;
  totalFixturesInSeason: number;
  roi: number | null;
  clv: number | null;
  winRate: number | null;
  calibrationBrier: number | null;
  lastCalibratedAt: string | null;
}

// Get the current profile for a league
export async function getLeagueProfile(leagueId: number): Promise<LeagueProfile | null> {
  const { data } = await supabase
    .from('league_evolution')
    .select('*')
    .eq('league_id', leagueId)
    .single();

  if (!data) return null;

  return {
    leagueId: data.league_id as number,
    leagueName: data.league_name as string,
    season: data.season as number,
    certification: data.certification as CertificationLevel,
    historicalCoveragePct: (data.historical_coverage_pct as number) ?? 0,
    predictionCount: (data.prediction_count as number) ?? 0,
    settledMatches: (data.settled_matches as number) ?? 0,
    totalFixturesInSeason: (data.total_fixtures_in_season as number) ?? 0,
    roi: data.roi as number | null,
    clv: data.clv as number | null,
    winRate: data.win_rate as number | null,
    calibrationBrier: data.calibration_brier as number | null,
    lastCalibratedAt: data.last_calibrated_at as string | null,
  };
}

// Initialize evolution tracking for all configured leagues (idempotent)
export async function initializeLeagues(): Promise<number> {
  let initialized = 0;

  const { data: configuredLeagues } = await supabase.from('league_efficiency').select('league_id, league_name');
  if (!configuredLeagues) return 0;

  for (const league of configuredLeagues) {
    const existing = await getLeagueProfile(league.league_id);
    if (existing) continue;

    await supabase.from('league_evolution').insert({
      league_id: league.league_id,
      league_name: league.league_name,
      season: new Date().getFullYear(),
      certification: 'research',
      historical_coverage_pct: 0,
      prediction_count: 0,
      settled_matches: 0,
      total_fixtures_in_season: 0,
    });

    initialized += 1;
  }

  return initialized;
}

// Get all league profiles sorted by certification + ROI
export async function getAllLeagueProfiles(): Promise<LeagueProfile[]> {
  const { data } = await supabase
    .from('league_evolution')
    .select('*')
    .order('certification', { ascending: false })
    .order('roi', { ascending: false, nullsFirst: false });

  if (!data) return [];
  return data.map((d: any) => ({
    leagueId: d.league_id,
    leagueName: d.league_name,
    season: d.season,
    certification: d.certification,
    historicalCoveragePct: d.historical_coverage_pct ?? 0,
    predictionCount: d.prediction_count ?? 0,
    settledMatches: d.settled_matches ?? 0,
    totalFixturesInSeason: d.total_fixtures_in_season ?? 0,
    roi: d.roi,
    clv: d.clv,
    winRate: d.win_rate,
    calibrationBrier: d.calibration_brier,
    lastCalibratedAt: d.last_calibrated_at,
  }));
}

// Run the evolution engine: check every league and promote if thresholds met
export async function runLeagueEvolution(): Promise<{
  promoted: number;
  initialized: number;
}> {
  const initialized = await initializeLeagues();
  let promoted = 0;

  const profiles = await getAllLeagueProfiles();

  for (const profile of profiles) {
    const newCert = getNextCertification(profile);
    if (newCert !== profile.certification) {
      await supabase
        .from('league_evolution')
        .update({ certification: newCert, updated_at: new Date().toISOString() })
        .eq('league_id', profile.leagueId);

      await recordAuditEvent({
        jobId: `league-evolution-${profile.leagueId}-${Date.now()}`,
        triggerSource: 'league_evolution',
        leagueId: profile.leagueId,
        stateTransition: `${profile.certification}→${newCert}`,
        outcome: 'success',
        metadata: { predictionCount: profile.predictionCount, settledMatches: profile.settledMatches },
      });

      promoted += 1;
    }
  }

  return { promoted, initialized };
}

// Determine if a league qualifies for promotion
function getNextCertification(profile: LeagueProfile): CertificationLevel {
  const { settledMatches, predictionCount, calibrationBrier } = profile;

  switch (profile.certification) {
    case 'research':
      if (predictionCount >= 50) return 'historical_imported';
      break;
    case 'historical_imported':
      if (settledMatches >= 200) return 'calibrated';
      break;
    case 'calibrated':
      if (settledMatches >= 500 && calibrationBrier !== null && calibrationBrier < 0.25) return 'building_track_record';
      break;
    case 'building_track_record':
      if (settledMatches >= 1000 && calibrationBrier !== null && calibrationBrier < 0.2) return 'verified';
      break;
    case 'verified':
      break; // already at max
  }

  return profile.certification;
}
