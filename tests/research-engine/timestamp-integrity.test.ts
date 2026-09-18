import { describe, it, expect } from 'vitest';
import {
  PointInTimeReplayEngine,
  type MarketTickSeries,
} from '../../src/lib/research/market-state/pointInTimeReplay';

const KICKOFF_ISO = '2026-02-01T15:00:00.000Z';
const KICKOFF_MS = Date.parse(KICKOFF_ISO);

describe('Phase 1: Timestamp Integrity & Point-in-Time Replay Tests', () => {
  it('1. Strictly rejects in-play observations (t >= kickoff)', () => {
    const series: MarketTickSeries = {
      marketId: 1058,
      marketType: 'AH',
      line: -0.5,
      side: 'home',
      bookmaker: 'pinnacle',
      ticks: [
        { createdAt: '2026-02-01T14:45:00.000Z', price: 1.95 }, // valid pre-match (T-15m)
        { createdAt: '2026-02-01T15:00:00.000Z', price: 2.10 }, // EXACT kickoff -> REJECT
        { createdAt: '2026-02-01T15:05:00.000Z', price: 2.30 }, // In-play -> REJECT
        { createdAt: '2026-02-01T16:45:00.000Z', price: 4.50 }, // In-play -> REJECT
      ],
    };

    const res = PointInTimeReplayEngine.selectObservationForHorizon(series, KICKOFF_MS, 'T_15M');
    expect(res.observation).not.toBeNull();
    expect(res.observation?.odds).toBe(1.95);
    expect(res.observation?.providerTimestamp).toBe('2026-02-01T14:45:00.000Z');
    expect(res.inPlayCount).toBe(3); // 3 ticks >= kickoff rejected
  });

  it('2. Correctly extracts discrete multi-horizon snapshots without lookahead', () => {
    const series: MarketTickSeries = {
      marketId: 101,
      marketType: 'ML',
      line: null,
      side: 'home',
      bookmaker: 'pinnacle',
      ticks: [
        { createdAt: '2026-01-25T15:00:00.000Z', price: 2.20 }, // T-7d (exactly 7 days)
        { createdAt: '2026-01-29T15:00:00.000Z', price: 2.15 }, // T-72h (exactly 3 days)
        { createdAt: '2026-01-31T15:00:00.000Z', price: 2.05 }, // T-24h (exactly 1 day)
        { createdAt: '2026-02-01T09:00:00.000Z', price: 2.02 }, // T-6h
        { createdAt: '2026-02-01T14:00:00.000Z', price: 1.98 }, // T-1h
        { createdAt: '2026-02-01T14:50:00.000Z', price: 1.94 }, // T-15m (Closing)
      ],
    };

    const snapshots = PointInTimeReplayEngine.reconstructMatchHorizons(
      'ENG-PL|2025-2026|2026-02-01|team-a|team-b',
      KICKOFF_ISO,
      [series]
    );

    expect(snapshots.T_7D.observations[0].odds).toBe(2.20);
    expect(snapshots.T_72H.observations[0].odds).toBe(2.15);
    expect(snapshots.T_24H.observations[0].odds).toBe(2.05);
    expect(snapshots.T_6H.observations[0].odds).toBe(2.02);
    expect(snapshots.T_1H.observations[0].odds).toBe(1.98);
    expect(snapshots.T_15M.observations[0].odds).toBe(1.94);

    expect(snapshots.T_7D.status).toBe('COMPLETE');
    expect(snapshots.T_15M.status).toBe('COMPLETE');
  });

  it('3. Handles missing horizon honestly without fabricating snapshots', () => {
    // Only pre-match quotes at T-1h and T-15m; missing T-7d, T-72h, T-24h
    const series: MarketTickSeries = {
      marketId: 104,
      marketType: 'BTTS',
      line: null,
      side: 'yes',
      bookmaker: 'pinnacle',
      ticks: [
        { createdAt: '2026-02-01T14:00:00.000Z', price: 1.80 },
        { createdAt: '2026-02-01T14:48:00.000Z', price: 1.82 },
      ],
    };

    const snapshots = PointInTimeReplayEngine.reconstructMatchHorizons(
      'ENG-PL|2025-2026|2026-02-01|team-a|team-b',
      KICKOFF_ISO,
      [series]
    );

    expect(snapshots.T_7D.status).toBe('MISSING_SNAPSHOT');
    expect(snapshots.T_7D.observations.length).toBe(0);

    expect(snapshots.T_72H.status).toBe('MISSING_SNAPSHOT');
    expect(snapshots.T_72H.observations.length).toBe(0);

    expect(snapshots.T_24H.status).toBe('MISSING_SNAPSHOT');
    expect(snapshots.T_24H.observations.length).toBe(0);

    expect(snapshots.T_1H.status).toBe('COMPLETE');
    expect(snapshots.T_1H.observations[0].odds).toBe(1.80);

    expect(snapshots.T_15M.status).toBe('COMPLETE');
    expect(snapshots.T_15M.observations[0].odds).toBe(1.82);
  });

  it('4. Ignores ticks with invalid timestamps or nonsensical prices', () => {
    const series: MarketTickSeries = {
      marketId: 108,
      marketType: 'OU',
      line: 2.5,
      side: 'over',
      bookmaker: 'pinnacle',
      ticks: [
        { createdAt: 'invalid-date', price: 1.95 },
        { createdAt: '2026-02-01T14:40:00.000Z', price: 0.50 }, // price <= 1.0 invalid
        { createdAt: '2026-02-01T14:45:00.000Z', price: 1.92 }, // valid
      ],
    };

    const res = PointInTimeReplayEngine.selectObservationForHorizon(series, KICKOFF_MS, 'T_15M');
    expect(res.observation).not.toBeNull();
    expect(res.observation?.odds).toBe(1.92);
  });
});

