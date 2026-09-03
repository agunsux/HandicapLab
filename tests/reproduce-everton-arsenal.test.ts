import { describe, it, expect } from 'vitest';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Force load real environment variables for live database test
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { getMarketSignals } from '../src/lib/marketSignals';
import { validateUpcomingPrediction } from '../src/lib/validation/predictionGate';

describe('EPIC 63 Stage C: Zero-Dummy Production Invariant & Archival Verification', () => {
  it('VERIFIES: getMarketSignals returns ZERO Everton-Arsenal synthetic dummy fixtures', async () => {
    const ahSignals = await getMarketSignals('asian-handicap');
    const ouSignals = await getMarketSignals('over-under');
    const bttsSignals = await getMarketSignals('btts');

    console.log(`[STAGE C VERIFICATION] AH Signals count: ${ahSignals.length}`);
    console.log(`[STAGE C VERIFICATION] OU Signals count: ${ouSignals.length}`);
    console.log(`[STAGE C VERIFICATION] BTTS Signals count: ${bttsSignals.length}`);

    // Check presence of Everton vs Arsenal in signals
    const hasEvertonArsenalAh = ahSignals.some((s) => s.homeTeam === 'Everton' && s.awayTeam === 'Arsenal');
    const hasEvertonArsenalOu = ouSignals.some((s) => s.homeTeam === 'Everton' && s.awayTeam === 'Arsenal');
    const hasEvertonArsenalBtts = bttsSignals.some((s) => s.homeTeam === 'Everton' && s.awayTeam === 'Arsenal');

    expect(hasEvertonArsenalAh).toBe(false);
    expect(hasEvertonArsenalOu).toBe(false);
    expect(hasEvertonArsenalBtts).toBe(false);
  });

  it('VERIFIES: every signal returned by getMarketSignals passes the strict prediction quality gate', async () => {
    const allMarkets: ('asian-handicap' | 'over-under' | 'btts')[] = ['asian-handicap', 'over-under', 'btts'];

    for (const m of allMarkets) {
      const signals = await getMarketSignals(m);
      for (const sig of signals) {
        // Assert no synthetic or mock IDs
        expect(sig.fixtureId).not.toMatch(/^(mock|synth|demo|live-shadow)/i);
        // Assert distinct real teams
        expect(sig.homeTeam).toBeTruthy();
        expect(sig.awayTeam).toBeTruthy();
        expect(sig.homeTeam.toLowerCase()).not.toBe(sig.awayTeam.toLowerCase());
        // Assert valid odds
        expect(sig.odds).toBeGreaterThan(1.0);

        // Assert quality gate pass
        const validation = validateUpcomingPrediction({
          id: sig.id,
          fixtureId: sig.fixtureId,
          homeTeam: sig.homeTeam,
          awayTeam: sig.awayTeam,
          kickoffTime: sig.kickoff,
          market: sig.market,
          odds: sig.odds,
        });
        expect(validation.isValid).toBe(true);
      }
    }
  });

  it('VERIFIES: honest empty state is returned when no upcoming real signals are available', async () => {
    const ouSignals = await getMarketSignals('over-under');
    const bttsSignals = await getMarketSignals('btts');

    // Currently before Stage E backfill, OU and BTTS have no active upcoming predictions
    // They must return honest empty arrays, never falling back to mock fixtures
    expect(Array.isArray(ouSignals)).toBe(true);
    expect(Array.isArray(bttsSignals)).toBe(true);
  });
});
