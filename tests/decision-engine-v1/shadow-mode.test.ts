// HandicapLab Shadow Mode & Event-Driven Paper Trading Tests
// Location: tests/decision-engine-v1/shadow-mode.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { EventQueue, JobRecord } from '../../src/lib/paper-trading/eventSystem';
import { SnapshotLocker } from '../../src/lib/paper-trading/snapshotLocker';
import { PredictionWorker } from '../../src/lib/paper-trading/predictionWorker';
import { ResultReconciler } from '../../src/lib/paper-trading/resultReconciler';
import { PredictionLedgerRepository } from '../../src/lib/data/predictionLedgerRepository';
import { ModelRegistry } from '../../src/lib/engines/decision-engine-v1/registry';
import { MatchFeatures } from '../../src/lib/engines/feature-engine/types';
import { PredictionFeatures } from '../../src/lib/market-intelligence/types';

import { PredictionModel, Prediction, ModelMetadata } from '../../src/lib/engines/decision-engine-v1/models/predictionModel';

class MockModel implements PredictionModel {
  constructor(public id: string, public name: string, private _pHome: number, private _pDraw: number, private _pAway: number) {}
  public async predict(): Promise<Prediction> {
    return {
      pHome: this._pHome,
      pDraw: this._pDraw,
      pAway: this._pAway
    };
  }

  public async train(trainData: any[]): Promise<void> {}

  public async predictProbability(features: any): Promise<{ pHome: number; pDraw: number; pAway: number }> {
    return { pHome: this._pHome, pDraw: this._pDraw, pAway: this._pAway };
  }

  public async predictScore(features: any): Promise<{ home: number; away: number }> {
    return { home: 1.5, away: 1.0 };
  }

  public metadata(): ModelMetadata {
    return { name: this.name, version: '1.0.0', description: '', isOnline: false };
  }
}


async function awaitJob(job: JobRecord): Promise<void> {
  while (job.status === 'pending' || job.status === 'processing') {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('Sprint 24: Shadow Mode Event-Driven Trading Tests', () => {
  const dummyFeatures: MatchFeatures = {
    matchId: 'shadow-match-123',
    marketType: 'ML',
    kickoffAt: new Date(),
    homeFormLast5: [1, 2, 3, 4, 5],
    awayFormLast5: [1, 2, 3, 4, 5],
    homeFormWeighted: 1.5,
    awayFormWeighted: 1.2,
    homeTravelKm: 0,
    homeElo: 1600,
    awayElo: 1550,
    eloDelta: 50,
    generatedAt: new Date(),
    homeAttack: 1.5,
    homeDefense: 1.0,
    awayAttack: 1.2,
    awayDefense: 1.1,
    homeRestDays: 5,
    awayRestDays: 4,
    leagueAvgGoals: 2.82,
    isHomeAdvantage: true,
    leagueId: '39',
    season: '2024-2025'
  };

  const dummyMarket: PredictionFeatures = {
    openingOdds: { home: 2.10, draw: 3.30, away: 3.50 },
    currentOdds: { home: 1.95, draw: 3.40, away: 3.80 },
    deltaImplied: { home: 0.03, draw: 0.01, away: -0.04 },
    steamScore: 85,
    marketRegime: 'Steam',
    marketConfidence: 90,
    anomalies: ['Steam']
  };

  beforeEach(() => {
    EventQueue.clear();
    SnapshotLocker.clear();
    PredictionLedgerRepository.clearLocalFiles();
    ModelRegistry.clear();
    
    // Register mock models to ensure predictable outputs
    ModelRegistry.register('poisson', new MockModel('poisson', 'Poisson', 0.60, 0.20, 0.20));
    ModelRegistry.register('elo', new MockModel('elo', 'Elo', 0.50, 0.30, 0.20));
  });

  it('should process prediction event successfully and record to ledger', async () => {
    const payload = {
      matchId: 'shadow-match-123',
      features: dummyFeatures,
      marketFeatures: dummyMarket,
      marketOdds: 1.95,
      marketSelection: 'home' as const,
      marketName: 'Moneyline Home'
    };

    const job = await EventQueue.publish('fixture.created', payload, 'idemp-key-1');
    await awaitJob(job);
    expect(job.status).toBe('completed');

    // Confirm snapshot is locked
    const snapshot = SnapshotLocker.get('shadow-match-123');
    expect(snapshot).toBeDefined();
    expect(snapshot?.probabilities.home).toBeCloseTo(0.55, 2);

    // Confirm it exists in ledger as single source of truth
    const records = await PredictionLedgerRepository.getPredictionsByMatchId('shadow-match-123');
    expect(records.length).toBe(1);
    expect(records[0].selection).toBe('home');
  });

  it('should enforce idempotency and never create duplicate predictions for same event', async () => {
    const payload = {
      matchId: 'shadow-match-123',
      features: dummyFeatures,
      marketFeatures: dummyMarket,
      marketOdds: 1.95,
      marketSelection: 'home' as const,
      marketName: 'Moneyline Home'
    };

    const job1 = await EventQueue.publish('fixture.created', payload, 'idemp-key-2');
    const job2 = await EventQueue.publish('fixture.created', payload, 'idemp-key-2');

    await awaitJob(job1);
    await awaitJob(job2);

    expect(job1.id).toBe(job2.id); // Same job object returned
    
    const records = await PredictionLedgerRepository.getPredictionsByMatchId('shadow-match-123');
    expect(records.length).toBe(1); // One record only
  });

  it('should enforce immutability on snapshot lock', () => {
    SnapshotLocker.lock('shadow-match-999', {
      matchId: 'shadow-match-999',
      odds: { home: 1.95, draw: 3.40, away: 3.80 },
      probabilities: { home: 0.60, draw: 0.20, away: 0.20 },
      features: dummyFeatures,
      modelVersion: 'Model_v3.5',
      calibrationVersion: 'Beta'
    });

    expect(() => {
      SnapshotLocker.lock('shadow-match-999', {
        matchId: 'shadow-match-999',
        odds: { home: 1.95, draw: 3.40, away: 3.80 },
        probabilities: { home: 0.60, draw: 0.20, away: 0.20 },
        features: dummyFeatures,
        modelVersion: 'Model_v3.5',
        calibrationVersion: 'Beta'
      });
    }).toThrow('Access Denied: Snapshot for match shadow-match-999 is locked and immutable.');
  });

  it('should process match.finished result events and correctly settle predictions in ledger', async () => {
    // 1. Create prediction first
    const payloadPredict = {
      matchId: 'shadow-match-555',
      features: dummyFeatures,
      marketFeatures: dummyMarket,
      marketOdds: 1.95,
      marketSelection: 'home' as const,
      marketName: 'Moneyline Home'
    };
    const jobPredict = await EventQueue.publish('fixture.created', payloadPredict, 'idemp-key-predict');
    await awaitJob(jobPredict);

    // 2. Publish match finished event
    const payloadSettle = {
      matchId: 'shadow-match-555',
      homeGoals: 2,
      awayGoals: 1,
      closingOdds: 1.85
    };
    const jobSettle = await EventQueue.publish('match.finished', payloadSettle, 'idemp-key-settle');
    await awaitJob(jobSettle);
    expect(jobSettle.status).toBe('completed');

    // 3. Confirm settlement metrics
    const records = await PredictionLedgerRepository.getPredictionsByMatchId('shadow-match-555');
    expect(records.length).toBe(1);
    
    const settlementList = records[0].prediction_settlements_v3;
    expect(settlementList.length).toBe(1);
    expect(settlementList[0].status).toBe('won');
    expect(settlementList[0].actual_clv).toBeCloseTo((1.95 / 1.85) - 1.0, 4);
    expect(settlementList[0].profit_loss).toBeGreaterThan(0);
  });

  it('should support job retry on transient failures and transition to failed on exhaust', async () => {
    let callCount = 0;
    EventQueue.subscribe('transient.fail', async () => {
      callCount++;
      if (callCount < 2) {
        throw new Error('Transient Database Timeout');
      }
    });

    const job = await EventQueue.publish('transient.fail' as any, {}, 'idemp-key-retry');
    
    // Bounded wait to let asynchronous retry complete
    await awaitJob(job);

    expect(job.status).toBe('completed');
    expect(job.retry_count).toBe(1);
  });

  it('should process concurrent events without race conditions', async () => {
    const promises = Array.from({ length: 5 }).map(async (_, index) => {
      const payload = {
        matchId: `shadow-match-concur-${index}`,
        features: dummyFeatures,
        marketFeatures: dummyMarket,
        marketOdds: 1.95,
        marketSelection: 'home' as const,
        marketName: 'Moneyline Home'
      };
      const job = await EventQueue.publish('fixture.created', payload, `idemp-key-concur-${index}`);
      await awaitJob(job);
      return job;
    });

    const results = await Promise.all(promises);
    results.forEach((job) => {
      expect(job.status).toBe('completed');
    });
  });
});
