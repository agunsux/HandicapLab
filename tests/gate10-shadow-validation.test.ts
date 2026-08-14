import { describe, it, expect } from 'vitest';
import {
  ShadowValidationEngine,
  type ShadowFixtureInput,
  type ShadowOddsQuote,
  type ShadowModelPrediction,
} from '@/historical/shadow/shadowValidationEngine';

describe('GATE 10 — Prospective Shadow Validation & Ledger Integrity Suite', () => {
  const baseFixture: ShadowFixtureInput = {
    fixture_id: 'TEST-FIX-01',
    competition: 'Premier League',
    season: '2025-2026',
    home_team: 'Team A',
    away_team: 'Team B',
    kickoff_timestamp: '2026-08-20T15:00:00.000Z',
    status: 'SCHEDULED',
  };

  const validQuote: ShadowOddsQuote = {
    quote_id: 'q_01',
    fixture_id: 'TEST-FIX-01',
    market: 'ML',
    selection: 'HOME',
    line: null,
    bookmaker: 'Pinnacle',
    odds: 2.00,
    observed_at: '2026-08-19T14:50:00.000Z',
  };

  const validModel: ShadowModelPrediction = {
    fixture_id: 'TEST-FIX-01',
    market: 'ML',
    selection: 'HOME',
    line: null,
    model_probability: 0.55,
    cal_probability: 0.55,
    model_version: ShadowValidationEngine.MODEL_VERSION,
    generated_at: '2026-08-19T15:00:00.000Z',
  };

  it('enforces temporal integrity by rejecting predictions generated at or after kickoff', () => {
    const engine = new ShadowValidationEngine();
    const pastTimestamp = '2026-08-20T15:00:01.000Z'; // 1 second after kickoff

    const res = engine.processOpportunity(baseFixture, validQuote, validModel, pastTimestamp);
    expect(res.status).toBe('REJECTED');
    expect(res.reason).toBe('KICKOFF_IN_PAST');
  });

  it('rejects stale odds quotes exceeding maximum age window', () => {
    const engine = new ShadowValidationEngine();
    const staleQuote: ShadowOddsQuote = {
      ...validQuote,
      observed_at: '2026-08-19T10:00:00.000Z', // 5 hours prior to prediction
    };

    const res = engine.processOpportunity(baseFixture, staleQuote, validModel, '2026-08-19T15:00:00.000Z');
    expect(res.status).toBe('REJECTED');
    expect(res.reason).toBe('STALE_ODDS');
  });

  it('rejects deferred markets like BTTS in accordance with strategy fidelity', () => {
    const engine = new ShadowValidationEngine();
    const bttsQuote: ShadowOddsQuote = {
      ...validQuote,
      market: 'BTTS',
      selection: 'YES',
    };
    const bttsModel: ShadowModelPrediction = {
      ...validModel,
      market: 'BTTS',
      selection: 'YES',
    };

    const res = engine.processOpportunity(baseFixture, bttsQuote, bttsModel, '2026-08-19T15:00:00.000Z');
    expect(res.status).toBe('REJECTED');
    expect(res.reason).toBe('UNSUPPORTED_MARKET');
  });

  it('rejects odds outside the approved [1.40, 3.50] exposure window', () => {
    const engine = new ShadowValidationEngine();
    const highOddsQuote: ShadowOddsQuote = {
      ...validQuote,
      odds: 4.20,
    };
    const lowOddsQuote: ShadowOddsQuote = {
      ...validQuote,
      odds: 1.30,
    };

    const resHigh = engine.processOpportunity(baseFixture, highOddsQuote, validModel, '2026-08-19T15:00:00.000Z');
    expect(resHigh.status).toBe('REJECTED');
    expect(resHigh.reason).toBe('ODDS_OUT_OF_BOUNDS');

    const resLow = engine.processOpportunity(baseFixture, lowOddsQuote, validModel, '2026-08-19T15:00:00.000Z');
    expect(resLow.status).toBe('REJECTED');
    expect(resLow.reason).toBe('ODDS_OUT_OF_BOUNDS');
  });

  it('rejects sub-threshold EV (< 3.0%)', () => {
    const engine = new ShadowValidationEngine();
    const lowEvModel: ShadowModelPrediction = {
      ...validModel,
      cal_probability: 0.505, // EV = 0.505 * 2.00 - 1 = +1.0% (< 3.0%)
    };

    const res = engine.processOpportunity(baseFixture, validQuote, lowEvModel, '2026-08-19T15:00:00.000Z');
    expect(res.status).toBe('REJECTED');
    expect(res.reason).toBe('EV_BELOW_THRESHOLD');
  });

  it('enforces duplicate protection preventing duplicate bets on the same market event', () => {
    const engine = new ShadowValidationEngine();
    const res1 = engine.processOpportunity(baseFixture, validQuote, validModel, '2026-08-19T15:00:00.000Z');
    expect(res1.status).toBe('LOCKED');

    const res2 = engine.processOpportunity(baseFixture, validQuote, validModel, '2026-08-19T15:00:00.000Z');
    expect(res2.status).toBe('REJECTED');
    expect(res2.reason).toBe('DUPLICATE_POSITION');
  });

  it('computes SHA-256 fingerprint and detects data tampering on locked prediction', () => {
    const engine = new ShadowValidationEngine();
    const res = engine.processOpportunity(baseFixture, validQuote, validModel, '2026-08-19T15:00:00.000Z');
    expect(res.status).toBe('LOCKED');
    expect(res.record).toBeDefined();

    const record = res.record!;
    expect(ShadowValidationEngine.verifyPredictionIntegrity(record)).toBe(true);

    // Tamper with entry odds
    const tampered = { ...record, entry_odds: 2.50 };
    expect(ShadowValidationEngine.verifyPredictionIntegrity(tampered)).toBe(false);
  });

  it('accurately settles Moneyline, Asian Handicap (including quarter lines), and Over/Under', () => {
    const engine = new ShadowValidationEngine();

    // 1. Moneyline settlement
    const mlRes = engine.processOpportunity(baseFixture, validQuote, validModel, '2026-08-19T15:00:00.000Z');
    const mlSettled = engine.settlePrediction(mlRes.record!.prediction_id, 2, 1, 1.90, '2026-08-21T00:00:00.000Z');
    expect(mlSettled.settlement_status).toBe('WON');
    expect(mlSettled.pnl_units).toBe(1.0); // 1.0 * (2.00 - 1)
    expect(mlSettled.clv).toBeCloseTo(5.26, 1); // (2.00 / 1.90 - 1) * 100

    // 2. Asian Handicap -0.25 settlement (Quarter-line half win scenario)
    const ahFix: ShadowFixtureInput = { ...baseFixture, fixture_id: 'AH-FIX-01' };
    const ahQuote: ShadowOddsQuote = {
      ...validQuote,
      fixture_id: 'AH-FIX-01',
      market: 'AH',
      selection: 'HOME',
      line: -0.25,
      odds: 1.95,
    };
    const ahModel: ShadowModelPrediction = {
      ...validModel,
      fixture_id: 'AH-FIX-01',
      market: 'AH',
      selection: 'HOME',
      line: -0.25,
      cal_probability: 0.58,
    };
    const ahRes = engine.processOpportunity(ahFix, ahQuote, ahModel, '2026-08-19T15:00:00.000Z');
    // Draw: home 1, away 1 -> diff = 0 + (-0.25) = -0.25 -> HALF_LOST
    const ahSettled = engine.settlePrediction(ahRes.record!.prediction_id, 1, 1, 1.90, '2026-08-21T00:00:00.000Z');
    expect(ahSettled.settlement_status).toBe('HALF_LOST');
    expect(ahSettled.pnl_units).toBe(-0.5);

    // 3. Over/Under 2.5 settlement
    const ouFix: ShadowFixtureInput = { ...baseFixture, fixture_id: 'OU-FIX-01' };
    const ouQuote: ShadowOddsQuote = {
      ...validQuote,
      fixture_id: 'OU-FIX-01',
      market: 'OU25',
      selection: 'OVER',
      line: 2.5,
      odds: 1.90,
    };
    const ouModel: ShadowModelPrediction = {
      ...validModel,
      fixture_id: 'OU-FIX-01',
      market: 'OU25',
      selection: 'OVER',
      line: 2.5,
      cal_probability: 0.58,
    };
    const ouRes = engine.processOpportunity(ouFix, ouQuote, ouModel, '2026-08-19T15:00:00.000Z');
    const ouSettled = engine.settlePrediction(ouRes.record!.prediction_id, 3, 1, 1.85, '2026-08-21T00:00:00.000Z');
    expect(ouSettled.settlement_status).toBe('WON');
    expect(ouSettled.pnl_units).toBe(0.9);
  });

  it('guarantees settlement idempotency without duplicating records or altering history', () => {
    const engine = new ShadowValidationEngine();
    const res = engine.processOpportunity(baseFixture, validQuote, validModel, '2026-08-19T15:00:00.000Z');
    const s1 = engine.settlePrediction(res.record!.prediction_id, 2, 0, 1.90, '2026-08-21T00:00:00.000Z');
    const s2 = engine.settlePrediction(res.record!.prediction_id, 2, 0, 1.90, '2026-08-21T00:00:00.000Z');

    expect(s1.prediction_id).toBe(s2.prediction_id);
    expect(s1.pnl_units).toBe(s2.pnl_units);
    expect(engine.getLedger().length).toBe(1);
  });
});
