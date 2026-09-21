import { describe, it, expect, beforeEach } from 'vitest';
import { PredictionArchiveService } from '@/lib/archive/predictionArchiveService';
import { ModelVersionRegistry } from '@/lib/archive/modelVersionRegistry';
import { ForensicAuditService } from '@/lib/archive/forensicAuditService';

describe('Prediction Archive Immutability & Forensic Auditability', () => {
  beforeEach(() => {
    PredictionArchiveService.clearStoreForTesting();
  });

  it('records prediction immutably with deterministic provenance hash and model version', async () => {
    const modelDef = ModelVersionRegistry.getActiveModelVersion('AH');
    expect(modelDef.versionId).toBe('dixon-coles-v1.0');

    const result = await PredictionArchiveService.recordPrediction({
      fixtureId: '1557408',
      canonicalMatchId: 'EPL_2026_BRENTFORD_CHELSEA_2026-09-18',
      homeTeam: 'Brentford',
      awayTeam: 'Chelsea',
      competition: 'Premier League',
      leagueKey: 'epl',
      market: 'AH',
      line: -0.25,
      selection: 'Brentford -0.25',
      modelProbability: 0.485,
      fairOdds: 2.062,
      marketOdds: 2.33,
      bookmaker: 'Pinnacle',
      oddsProvider: 'OddsPapi',
      edge: 0.052,
      expectedValue: 0.13,
      decision: 'VALUE_CANDIDATE',
      confidence: 78,
      strengthLevel: 'HIGH',
      signalColor: 'green',
      predictionTimestamp: '2026-09-18T10:00:00.000Z',
      oddsTimestamp: '2026-09-18T09:55:00.000Z',
      kickoffTimestamp: '2026-09-18T19:00:00.000Z',
      modelVersion: modelDef.versionId,
      modelParametersVersion: 'params-epl-2026-v1',
      dataVersion: 'canonical-production-v1',
      featureSnapshotId: 'feat_1557408',
      oddsSnapshotId: 'odds_1557408',
      scoreGridSummary: {
        homeXG: 1.45,
        awayXG: 1.15,
        rho: -0.05,
      },
      status: 'ACTIVE',
      settlement: null,
    });

    expect(result.isNew).toBe(true);
    expect(result.record.predictionId).toBeDefined();
    expect(result.record.provenanceHash).toBeDefined();
    expect(result.record.provenanceHash.length).toBe(64); // sha-256

    // Verify idempotency: subsequent write with identical parameters returns same record
    const duplicateWrite = await PredictionArchiveService.recordPrediction({
      ...result.record,
    });
    expect(duplicateWrite.isNew).toBe(false);
    expect(duplicateWrite.record.predictionId).toBe(result.record.predictionId);
  });

  it('permanently freezes prediction parameters upon match kickoff', async () => {
    const kickoffUtc = '2026-09-18T15:00:00.000Z';
    const kickoffMs = new Date(kickoffUtc).getTime();

    const { record } = await PredictionArchiveService.recordPrediction({
      fixtureId: '1557409',
      canonicalMatchId: 'EPL_2026_ARSENAL_EVERTON_2026-09-18',
      homeTeam: 'Arsenal',
      awayTeam: 'Everton',
      competition: 'Premier League',
      leagueKey: 'epl',
      market: 'OU',
      line: 2.5,
      selection: 'Over 2.5',
      modelProbability: 0.58,
      fairOdds: 1.724,
      marketOdds: 1.95,
      bookmaker: 'Pinnacle',
      oddsProvider: 'OddsPapi',
      edge: 0.065,
      expectedValue: 0.131,
      decision: 'VALUE_CANDIDATE',
      confidence: 82,
      strengthLevel: 'VERY_HIGH',
      signalColor: 'green',
      predictionTimestamp: '2026-09-18T10:00:00.000Z',
      oddsTimestamp: '2026-09-18T09:55:00.000Z',
      kickoffTimestamp: kickoffUtc,
      modelVersion: 'dixon-coles-v1.0',
      modelParametersVersion: 'params-epl-2026-v1',
      dataVersion: 'canonical-production-v1',
      featureSnapshotId: 'feat_1557409',
      oddsSnapshotId: 'odds_1557409',
      scoreGridSummary: { homeXG: 2.1, awayXG: 0.8, rho: -0.05 },
      status: 'ACTIVE',
      settlement: null,
    });

    // Before kickoff: not locked
    const preKickoffLocked = await PredictionArchiveService.lockPredictionsForKickoff(kickoffMs - 1000);
    expect(preKickoffLocked).toBe(0);

    // At/after kickoff: permanently locked to KICKED_OFF
    const postKickoffLocked = await PredictionArchiveService.lockPredictionsForKickoff(kickoffMs + 1000);
    expect(postKickoffLocked).toBe(1);

    const archive = PredictionArchiveService.loadArchive();
    expect(archive[record.predictionId].status).toBe('KICKED_OFF');

    // Attempting to overwrite post-kickoff returns frozen record without mutation
    const overwriteAttempt = await PredictionArchiveService.recordPrediction({
      ...record,
      marketOdds: 3.50, // attempted spoofed odds
    });
    expect(overwriteAttempt.record.status).toBe('KICKED_OFF');
    expect(overwriteAttempt.record.marketOdds).toBe(1.95);
  });

  it('audits complete formula lineage from score grid to odds and settlement', async () => {
    const { record } = await PredictionArchiveService.recordPrediction({
      fixtureId: '1557410',
      canonicalMatchId: 'EPL_2026_LIVERPOOL_MANUTD_2026-09-20',
      homeTeam: 'Liverpool',
      awayTeam: 'Manchester United',
      competition: 'Premier League',
      leagueKey: 'epl',
      market: 'BTTS',
      line: 0,
      selection: 'BTTS YES',
      modelProbability: 0.62,
      fairOdds: 1.613,
      marketOdds: 1.80,
      bookmaker: 'Pinnacle',
      oddsProvider: 'OddsPapi',
      edge: 0.064,
      expectedValue: 0.116,
      decision: 'VALUE_CANDIDATE',
      confidence: 80,
      strengthLevel: 'HIGH',
      signalColor: 'green',
      predictionTimestamp: '2026-09-20T10:00:00.000Z',
      oddsTimestamp: '2026-09-20T09:55:00.000Z',
      kickoffTimestamp: '2026-09-20T15:30:00.000Z',
      modelVersion: 'BTTS-jointscore-v1.0.0',
      modelParametersVersion: 'params-btts-2026-v1',
      dataVersion: 'canonical-production-v1',
      featureSnapshotId: 'feat_1557410',
      oddsSnapshotId: 'odds_1557410',
      scoreGridSummary: { homeXG: 1.85, awayXG: 1.40, rho: -0.05 },
      status: 'ACTIVE',
      settlement: null,
    });

    const audit = ForensicAuditService.auditPrediction(record.predictionId);
    expect(audit).not.toBeNull();
    expect(audit!.reconstructionStatus).toBe('VERIFIED');
    expect(audit!.lineage.provenance.provenanceHash.length).toBe(64);
    expect(audit!.lineage.lifecycleStages.generated).toBe(true);
    expect(audit!.lineage.lifecycleStages.verified).toBe(true);
    expect(audit!.lineage.modelDetails.modelVersion).toBe('BTTS-jointscore-v1.0.0');
    expect(audit!.lineage.derivation.market).toBe('BTTS');
  });
});
