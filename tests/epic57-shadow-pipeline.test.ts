// EPIC 57 — Automated Shadow Pipeline Unit Test Suite
// Location: tests/epic57-shadow-pipeline.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  DailyAhShadowPipeline,
  RESEARCH_HONESTY_BANNER,
  DailyFixtureCandidate,
} from '../src/lib/pipeline/dailyAhShadowPipeline';
import { CanonicalMatch } from '../src/lib/research/ah-solo/ahTypes';

describe('EPIC 57: Automated Shadow Pipeline', () => {
  const ledgerPath = path.resolve(process.cwd(), 'data', 'ledger', 'ah_predictions_ledger.jsonl');

  const sampleHistoricalMatches: CanonicalMatch[] = [
    {
      canonicalId: 'ENG-PL|2025-2026|2025-09-01|arsenal|chelsea',
      leagueId: 'ENG-PL',
      cluster: 'A',
      season: '2025-2026',
      matchDate: '2025-09-01',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      homeGoals: 2,
      awayGoals: 1,
      result: 'H',
      resultVerified: true,
      totalGoals: 3,
    },
    {
      canonicalId: 'ENG-PL|2025-2026|2025-09-15|chelsea|arsenal',
      leagueId: 'ENG-PL',
      cluster: 'A',
      season: '2025-2026',
      matchDate: '2025-09-15',
      homeTeam: 'Chelsea',
      awayTeam: 'Arsenal',
      homeGoals: 1,
      awayGoals: 1,
      result: 'D',
      resultVerified: true,
      totalGoals: 2,
    },
  ];

  beforeEach(() => {
    // Reset test ledger
    DailyAhShadowPipeline.ensureLedgerDir();
    if (fs.existsSync(ledgerPath)) {
      fs.unlinkSync(ledgerPath);
    }
  });

  it('generates upcoming shadow predictions and writes full provenance to ledger', async () => {
    const upcoming: DailyFixtureCandidate[] = [
      {
        fixtureId: 'TEST-FIXTURE-001',
        leagueId: 'ENG-PL',
        leagueName: 'Premier League',
        country: 'England',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoffTime: '2026-09-01T15:00:00.000Z',
        status: 'NS',
        openingOdds: [
          { line: -0.5, homeOdds: 1.95, awayOdds: 1.95, bookmaker: 'pinnacle', timestamp: '2026-09-01T10:00:00.000Z' },
          { line: -0.25, homeOdds: 1.72, awayOdds: 2.18, bookmaker: 'pinnacle', timestamp: '2026-09-01T10:00:00.000Z' },
        ],
      },
    ];

    const { generatedRecords, failures } = await DailyAhShadowPipeline.executeDailyPredictions(
      upcoming,
      sampleHistoricalMatches
    );

    expect(failures).toHaveLength(0);
    // 2 odds lines * 2 sides (home/away) = 4 prediction records
    expect(generatedRecords).toHaveLength(4);

    for (const record of generatedRecords) {
      expect(record.modelVersion).toBe('AH-dixoncoles-v1.0.0');
      expect(record.featureVersion).toBe('pit-football-v1');
      expect(record.settlementStatus).toBe('PENDING');
      expect(record.researchStatusLabel).toBe(RESEARCH_HONESTY_BANNER);
      // Value qualification must NOT be QUALIFIED_VALUE (hard gate)
      expect(record.valueQualificationState).not.toBe('QUALIFIED_VALUE');
      expect(['NOT_VALIDATED', 'LOW_CONFIDENCE_EDGE', 'NO_EDGE', 'INSUFFICIENT_DATA']).toContain(
        record.valueQualificationState
      );
    }

    // Check persistence
    const saved = DailyAhShadowPipeline.loadLedger();
    expect(saved).toHaveLength(4);
  });

  it('automatically settles pending predictions when match finishes', async () => {
    const upcoming: DailyFixtureCandidate[] = [
      {
        fixtureId: 'TEST-FIXTURE-SETTLE-001',
        leagueId: 'ENG-PL',
        leagueName: 'Premier League',
        country: 'England',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoffTime: '2026-09-01T15:00:00.000Z',
        status: 'NS',
        openingOdds: [
          { line: -0.5, homeOdds: 1.95, awayOdds: 1.95, bookmaker: 'pinnacle', timestamp: '2026-09-01T10:00:00.000Z' },
        ],
      },
    ];

    await DailyAhShadowPipeline.executeDailyPredictions(upcoming, sampleHistoricalMatches);

    // Now fixture finishes with score 2-1 (Arsenal wins)
    const finished: DailyFixtureCandidate[] = [
      {
        fixtureId: 'TEST-FIXTURE-SETTLE-001',
        leagueId: 'ENG-PL',
        leagueName: 'Premier League',
        country: 'England',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoffTime: '2026-09-01T15:00:00.000Z',
        status: 'FT',
        homeGoals: 2,
        awayGoals: 1,
        closingOdds: [
          { line: -0.5, homeOdds: 1.90, awayOdds: 2.00, bookmaker: 'pinnacle', timestamp: '2026-09-01T14:55:00.000Z' },
        ],
      },
    ];

    const { settledCount, failures } = await DailyAhShadowPipeline.executeAutomatedSettlement(finished);

    expect(failures).toHaveLength(0);
    expect(settledCount).toBe(2); // Home and away predictions settled

    const ledger = DailyAhShadowPipeline.loadLedger();
    const homeRecord = ledger.find((r) => r.side === 'home');
    const awayRecord = ledger.find((r) => r.side === 'away');

    expect(homeRecord?.settlementStatus).toBe('SETTLED');
    expect(homeRecord?.actualOutcome).toBe('FULL_WIN');
    expect(homeRecord?.profitLoss).toBeCloseTo(0.95, 2);
    expect(homeRecord?.clv).toBeCloseTo(((1.95 / 1.90) - 1) * 100, 2); // +2.63%

    expect(awayRecord?.settlementStatus).toBe('SETTLED');
    expect(awayRecord?.actualOutcome).toBe('FULL_LOSS');
    expect(awayRecord?.profitLoss).toBeCloseTo(-1.0, 2);
  });

  it('tracks progress toward the 150-200 settled gate in summary', async () => {
    const summary = DailyAhShadowPipeline.generatePipelineSummary();
    expect(summary.mode).toBe('SHADOW_UNATTENDED');
    expect(summary.monetizationEnabled).toBe(false);
    expect(summary.targetSettledGate).toBe(175);
    expect(typeof summary.gateProgressPct).toBe('number');
  });
});
