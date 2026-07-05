import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketFeaturePipeline } from '../src/lib/warehouse/market/marketFeaturePipeline';
import { supabase } from '../src/lib/supabase.server';

describe('Market Feature Pipeline & Quality Score Controls', () => {
  let pipeline: MarketFeaturePipeline;

  beforeEach(() => {
    pipeline = new MarketFeaturePipeline();
    vi.spyOn(supabase, 'from').mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null })
    } as any);
  });

  it('should run all market intelligence plugins and return metrics', async () => {
    const mockSnapshots = [
      { id: 'snap-1', bookmakerId: 'pinnacle', odds: 1.95, timestamp: '2026-07-01T12:00:00Z', oddsDropPct: 6.0 },
      { id: 'snap-2', bookmakerId: 'bet365', odds: 1.90, timestamp: '2026-07-01T12:05:00Z', oddsDropPct: 7.0 },
      { id: 'snap-3', bookmakerId: 'williamhill', odds: 1.85, timestamp: '2026-07-01T12:10:00Z', oddsDropPct: 8.0 },
      { id: 'snap-4', bookmakerId: 'average', odds: 1.92, timestamp: '2026-07-01T12:05:00Z' }
    ];

    const outcomes = await pipeline.execute(
      BigInt(1001),
      mockSnapshots,
      2.10, // opening
      1.95, // closing
      '2026-07-01T15:00:00Z'
    );

    // CLV: 2.10 / 1.95 - 1.0 = 0.0769
    expect(outcomes['CLV'].value).toBeCloseTo(0.0769, 3);
    expect(outcomes['CLV'].quality).toBe(1.0);

    // SteamMove: 3 bookmakers had drops > 5%
    expect(outcomes['SteamMove'].value).toBe(1.0);
    expect(outcomes['SteamMove'].lineage).toContain('bookmaker:pinnacle');

    // PinnacleDivergence: pinnacle 1.95 - average 1.92 = 0.03
    expect(outcomes['PinnacleDivergence'].value).toBe(0.03);
  });

  it('should degrade quality rating if required inputs are missing', async () => {
    const emptySnapshots: any[] = [];
    const outcomes = await pipeline.execute(
      BigInt(1002),
      emptySnapshots,
      0.0, // Invalid opening
      1.95, // Invalid closing
      '2026-07-01T15:00:00Z'
    );

    expect(outcomes['CLV'].quality).toBe(0.0);
    expect(outcomes['OddsDispersion'].quality).toBeLessThan(0.5);
  });
});
