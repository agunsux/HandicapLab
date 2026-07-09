// Shadow Pipeline Tests 1/2 — Prediction, Settlement, Odds Snapshots
import { describe, it, expect } from 'vitest';
import { createShadowPrediction, settlePrediction, resolveMarketOutcome } from '../src/lib/data/prediction/engine';
import { createOddsSnapshot, MemoryOddsSnapshotStore } from '../src/lib/data/snapshots/engine';
import type { Fixture, OddsSnapshot } from '../src/lib/data/providers/types';

function f(o?: Partial<Fixture>): Fixture {
  return { fixtureId: 'f1', league: 'EPL', season: '2425', tournamentStage: 'regular', homeTeam: 'A', awayTeam: 'B', kickoffTime: new Date(), status: 'upcoming', createdAt: new Date(), updatedAt: new Date(), ...o };
}
function o(o?: Partial<OddsSnapshot>): OddsSnapshot {
  return { id: 'o1', fixtureId: 'f1', bookmaker: 'pinnacle', marketType: 'moneyline', line: 0, priceHome: 2.1, priceAway: 3.8, priceDraw: 3.4, capturedAt: new Date(), providerName: 'test', rawResponseHash: 'abc', ...o };
}

describe('Prediction Reproducibility', () => {
  it('same input → same model_hash + probs', async () => {
    const s = new MemoryOddsSnapshotStore();
    const r1 = await createShadowPrediction({ fixture: f(), oddsSnapshot: o(), marketType: 'moneyline', line: 0 }, s);
    const r2 = await createShadowPrediction({ fixture: f(), oddsSnapshot: o(), marketType: 'moneyline', line: 0 }, s);
    expect(r1.prediction.modelHash).toBe(r2.prediction.modelHash);
    expect(r1.prediction.predictionProb).toBe(r2.prediction.predictionProb);
  });

  it('has inputDataHash (64) and modelHash (64)', async () => {
    const s = new MemoryOddsSnapshotStore();
    const { prediction } = await createShadowPrediction({ fixture: f(), oddsSnapshot: o(), marketType: 'moneyline', line: 0 }, s);
    expect(prediction.inputDataHash).toHaveLength(64);
    expect(prediction.modelHash).toHaveLength(64);
  });
});

describe('Odds Snapshot Immutability', () => {
  it('append-only preserves all snapshots', async () => {
    const store = new MemoryOddsSnapshotStore();
    const s1 = createOddsSnapshot('f1', 'moneyline', 0, 2.0, 3.5, 3.2, 'pinny', new Date('2025-01-10'), null);
    const s2 = createOddsSnapshot('f1', 'moneyline', 0, 2.1, 3.4, 3.3, 'pinny', new Date('2025-01-11'), s1.id);
    await store.append(s1); await store.append(s2);
    const all = await store.getFixturesnapshots('f1');
    expect(all).toHaveLength(2);
    expect(all[0].priceHome).toBe(2.0);
    expect(all[1].priceHome).toBe(2.1);
  });
  it('snapshots chain-hash linked', () => {
    const s1 = createOddsSnapshot('f1', 'moneyline', 0, 2.0, 3.5, 3.2, 'pinny', new Date('2025-01-10'), null);
    const s2 = createOddsSnapshot('f1', 'moneyline', 0, 2.1, 3.4, 3.3, 'pinny', new Date('2025-01-11'), s1.id);
    expect(s2.previousSnapshotId).toBe(s1.id);
    expect(s1.previousSnapshotId).toBeNull();
  });
});

describe('Settlement Correctness', () => {
  it('ML home win → 1', () => expect(resolveMarketOutcome('moneyline', 0, 'home', 2, 1).actualOutcome).toBe(1));
  it('ML home loss → 0', () => expect(resolveMarketOutcome('moneyline', 0, 'home', 1, 2).actualOutcome).toBe(0));
  it('ML draw → 0.5', () => expect(resolveMarketOutcome('moneyline', 0, 'home', 0, 0).actualOutcome).toBe(0.5));
  it('AH +0.5 covers draw', () => expect(resolveMarketOutcome('asian_handicap', 0.5, 'home', 1, 1).actualOutcome).toBe(1));
  it('AH -0.5 needs win', () => expect(resolveMarketOutcome('asian_handicap', -0.5, 'home', 1, 1).actualOutcome).toBe(0));
  it('AH 0 pk pushes draw', () => {
    const r = resolveMarketOutcome('asian_handicap', 0, 'home', 1, 1);
    expect(r.actualOutcome).toBe(0.5); expect(r.profit).toBe(0);
  });
  it('O 2.5 with 3g → win', () => expect(resolveMarketOutcome('over_under', 2.5, 'over', 2, 1).actualOutcome).toBe(1));
  it('U 2.5 with 1g → win', () => expect(resolveMarketOutcome('over_under', 2.5, 'under', 0, 1).actualOutcome).toBe(1));
  it('settlePrediction returns settled', async () => {
    const store = new MemoryOddsSnapshotStore();
    const { prediction } = await createShadowPrediction({ fixture: f(), oddsSnapshot: o(), marketType: 'moneyline', line: 0 }, store);
    const r = await settlePrediction(prediction, 2, 1, 0.48, 2.10);
    expect(r.isSettled).toBe(true);
    expect(r.actualOutcome).not.toBeNull();
  });
});