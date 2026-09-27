import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import { DailyPipelineOrchestrator } from '@/lib/pipeline/dailyOrchestrator';
import { RunIdentityService } from '@/lib/pipeline/runIdentity';
import { DailyPredictionLedgerService } from '@/lib/pipeline/dailyPredictionLedger';
import { SalmoSyncService } from '@/lib/pipeline/salmoSyncService';
import { CanonicalFixture } from '@/lib/services/canonicalFixtureRegistry';

describe('Epic: Daily Production Research & Decision Pipeline (16-Phase Engine)', () => {
  beforeEach(() => {
    RunIdentityService.clearForTesting();
    DailyPredictionLedgerService.clearForTesting();
    SalmoSyncService.clearForTesting();
  });

  const nowMs = Date.now();
  const kickoffUtc = new Date(nowMs + 24 * 3600 * 1000).toISOString();
  const oddsTime = new Date(nowMs - 5 * 60 * 1000).toISOString();

  const mockFixtures: CanonicalFixture[] = [
    {
      fixtureId: 'fix_test_arsenal_chelsea',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      competitionName: 'Premier League',
      competitionId: 39,
      season: '2025',
      kickoffUtc,
      status: 'SCHEDULED',
      providerFixtureId: '1001',
      source: 'api-football',
      firstSeenAt: oddsTime,
      lastSyncedAt: oddsTime,
      markets: {
        asianHandicap: {
          available: true,
          line: -0.5,
          homeOdds: 1.85,
          awayOdds: 2.05,
        },
        overUnder: {
          available: true,
          line: 2.5,
          overOdds: 1.90,
          underOdds: 1.95,
        },
        btts: {
          available: true,
          line: 0.5,
          yesOdds: 1.78,
          noOdds: 2.02,
        },
      },
    },
  ];

  it('executes all 16 phases successfully and produces daily artifacts', async () => {
    const report = await DailyPipelineOrchestrator.executeDailyRun({
      nowMs,
      trigger: 'SCHEDULER_CRON',
      customFixtures: mockFixtures,
    });

    expect(report.status).toBe('SUCCESS');
    expect(report.runId).toContain('daily-');
    expect(report.fixturesCount.next7Days).toBe(1);

    expect(report.predictionsCount.ah).toBeGreaterThan(0);
    expect(report.predictionsCount.btts).toBeGreaterThan(0);
    expect(report.predictionsCount.ou).toBeGreaterThan(0);
    expect(report.predictionsCount.total).toBe(
      report.predictionsCount.ah + report.predictionsCount.btts + report.predictionsCount.ou
    );

    expect(report.qualifiedCount.btts).toBe(0);

    expect(fs.existsSync(report.reportPaths.jsonPath)).toBe(true);
    expect(fs.existsSync(report.reportPaths.mdPath)).toBe(true);

    const jsonRaw = fs.readFileSync(report.reportPaths.jsonPath, 'utf8');
    const jsonParsed = JSON.parse(jsonRaw);
    expect(jsonParsed.runId).toBe(report.runId);
    expect(jsonParsed.productionTruth.realProviderData).toBe(true);
    expect(jsonParsed.productionTruth.dailyAutomation).toBe(true);

    const mdContent = fs.readFileSync(report.reportPaths.mdPath, 'utf8');
    expect(mdContent).toContain('# DAILY PIPELINE STATUS');
    expect(mdContent).toContain('Both Teams To Score (BTTS)');
    expect(mdContent).toContain('RESEARCH_ONLY');
  });

  it('is idempotent: running the pipeline twice does not generate duplicate predictions or crash', async () => {
    const report1 = await DailyPipelineOrchestrator.executeDailyRun({
      nowMs,
      trigger: 'SCHEDULER_CRON',
      customFixtures: mockFixtures,
    });

    const report2 = await DailyPipelineOrchestrator.executeDailyRun({
      nowMs,
      trigger: 'SCHEDULER_CRON',
      customFixtures: mockFixtures,
    });

    expect(report1.status).toBe('SUCCESS');
    expect(report2.status).toBe('SUCCESS');
    expect(report2.runId).toBe(report1.runId);
  });

  it('detects healthy pipeline status immediately after successful run', async () => {
    await DailyPipelineOrchestrator.executeDailyRun({
      nowMs,
      trigger: 'SCHEDULER_CRON',
      customFixtures: mockFixtures,
    });

    const health = RunIdentityService.isPipelineHealthy(26);
    expect(health.healthy).toBe(true);
    expect(health.status).toBe('HEALTHY');
    expect(health.lastRun).not.toBeNull();
  });

  it('detects stale pipeline if last success is older than maxAgeHours', () => {
    const oldMs = nowMs - 48 * 3600 * 1000;
    RunIdentityService.startDailyRun({ nowMs: oldMs, forceNew: true });
    const runId = RunIdentityService.generateRunId(oldMs);
    RunIdentityService.completeDailyRun(runId, 'SUCCESS', undefined, undefined, oldMs);

    const health = RunIdentityService.isPipelineHealthy(26);
    expect(health.healthy).toBe(false);
    expect(health.status).toBe('STALE');
    expect(health.hoursSinceLastSuccess).toBeGreaterThan(26);
  });
});
