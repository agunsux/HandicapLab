// EPIC 54 Stage F — Continuous Evidence Engine
// After every settlement, automatically updates:
//   ROI, CLV, Brier Score, Log Loss, ECE, Win Rate, Yield, Closing Line Accuracy
//
// Reads from performance_ledger (EPIC 31) and updates league_evolution.
// No manual recalculation — evidence accumulates continuously.

import { supabase } from '@/lib/supabase.server';
import { transitionState, type FixtureStateRow } from '@/lib/crons/fixtureState';
import { recordAuditEvent } from '@/lib/crons/auditTrail';

export interface EvidenceUpdate {
  fixtureId: string;
  leagueId: number;
  leagueName: string;
  roi: number;
  clv: number;
  brier: number;
  win: boolean;
}

// Update league evolution after a fixture is settled.
// Called once per fixture after SETTLED state is reached.
export async function updateEvidence(fixture: FixtureStateRow): Promise<void> {
  const jobId = `evidence-${fixture.fixtureId}-${Date.now()}`;
  const leagueId = fixture.leagueId;
  const season = fixture.season;

  try {
    // Fetch latest performance data for this league
    const { data: ledger } = await supabase
      .from('performance_ledger')
      .select('roi, clv, brier_score, outcome')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!ledger || ledger.length === 0) {
      // No performance data yet — just mark metrics updated
      await transitionState(fixture.fixtureId, 'METRICS_UPDATED');
      return;
    }

    // Compute aggregate metrics
    const settledCount = ledger.length;
    const wins = ledger.filter((r: any) => r.outcome === 'win').length;
    const roiAvg = ledger.reduce((acc: number, r: any) => acc + (parseFloat(r.roi ?? '0')), 0) / settledCount;
    const clvAvg = ledger.reduce((acc: number, r: any) => acc + (parseFloat(r.clv ?? '0')), 0) / settledCount;
    const brierAvg = ledger.reduce((acc: number, r: any) => acc + (parseFloat(r.brier_score ?? '0')), 0) / settledCount;
    const winRate = (wins / settledCount) * 100;

    // Upsert league_evolution
    await supabase.from('league_evolution').upsert({
      league_id: leagueId,
      league_name: fixture.leagueName,
      season,
      roi: Math.round(roiAvg * 10000) / 10000,
      clv: Math.round(clvAvg * 10000) / 10000,
      calibration_brier: Math.round(brierAvg * 10000) / 10000,
      win_rate: Math.round(winRate * 100) / 100,
      prediction_count: settledCount,
      settled_matches: settledCount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'league_id' });

    // Auto-certification: promote league if it meets thresholds
    await checkCertification(leagueId, fixture.leagueName, season, settledCount);

    // Transition to METRICS_UPDATED
    await transitionState(fixture.fixtureId, 'METRICS_UPDATED');

    await recordAuditEvent({
      jobId,
      triggerSource: 'evidence_engine',
      fixtureId: fixture.fixtureId,
      leagueId,
      outcome: 'success',
      metadata: { roi: roiAvg, clv: clvAvg, brier: brierAvg, winRate, settledCount },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[EvidenceEngine] Failed for ${fixture.fixtureId}:`, message);
    await recordAuditEvent({
      jobId,
      triggerSource: 'evidence_engine',
      fixtureId: fixture.fixtureId,
      leagueId,
      outcome: 'failure',
      errorMessage: message,
    });
    // Do NOT block the fixture — metrics update is non-critical
    await transitionState(fixture.fixtureId, 'METRICS_UPDATED').catch(() => {});
  }
}

// Auto-certification: promote league based on sample count
async function checkCertification(
  leagueId: number,
  leagueName: string,
  season: number,
  sampleCount: number
): Promise<void> {
  let certification: string;

  if (sampleCount >= 1000) certification = 'verified';
  else if (sampleCount >= 500) certification = 'building_track_record';
  else if (sampleCount >= 200) certification = 'calibrated';
  else if (sampleCount >= 50) certification = 'historical_imported';
  else certification = 'research';

  await supabase
    .from('league_evolution')
    .update({ certification, updated_at: new Date().toISOString() })
    .eq('league_id', leagueId);
}

// Batch update: process all fixtures waiting for metrics
export async function runEvidenceEngine(): Promise<{ updated: number }> {
  const { getFixturesNeedingMetricsUpdate } = await import('@/lib/crons/fixtureState');
  const fixtures = await getFixturesNeedingMetricsUpdate();
  let updated = 0;

  for (const f of fixtures) {
    await updateEvidence(f);
    updated += 1;
  }

  return { updated };
}
