import { describe, it, expect } from 'vitest';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { getMarketSignals, UnifiedMarketSignal, MarketDataStatus } from '../src/lib/marketSignals';

describe('EPIC 63 Stage D: Data Status Transparency & Provenance Verification', () => {
  const allMarkets: ('asian-handicap' | 'over-under' | 'btts')[] = [
    'asian-handicap',
    'over-under',
    'btts',
  ];

  it('VERIFIES: any returned signal includes valid dataStatus and sourceProvenance', async () => {
    for (const market of allMarkets) {
      const signals: UnifiedMarketSignal[] = await getMarketSignals(market);

      for (const sig of signals) {
        // Assert dataStatus is strictly typed according to the 4-level taxonomy
        expect([
          'LIVE',
          'HISTORICAL_MARKET_DATA',
          'HISTORICAL_MATCH_FACTS',
          'CALIBRATION_ONLY',
        ]).toContain(sig.dataStatus);

        // Assert sourceProvenance is non-empty and names a real verifiable source
        expect(sig.sourceProvenance).toBeTruthy();
        expect(typeof sig.sourceProvenance).toBe('string');

        // Disallow synthetic or mock claims in provenance
        expect(sig.sourceProvenance.toLowerCase()).not.toContain('mock');
        expect(sig.sourceProvenance.toLowerCase()).not.toContain('synthetic');
        expect(sig.sourceProvenance.toLowerCase()).not.toContain('demo');

        // Must name recognized providers
        const recognizedProviders = ['pinnacle', 'oddspapi', 'api-football', 'football-data', 'sbobet'];
        const matchesRecognized = recognizedProviders.some((p) =>
          sig.sourceProvenance.toLowerCase().includes(p)
        );
        expect(matchesRecognized).toBe(true);
      }
    }
  });

  it('VERIFIES: honest empty states are produced without mock fallback data', async () => {
    // Both OU and BTTS currently have 0 synthetic leaks and return honest empty arrays
    const ouSignals = await getMarketSignals('over-under');
    const bttsSignals = await getMarketSignals('btts');

    expect(Array.isArray(ouSignals)).toBe(true);
    expect(Array.isArray(bttsSignals)).toBe(true);

    // Verify zero Everton vs Arsenal dummy rows
    expect(ouSignals.some((s) => s.homeTeam === 'Everton' && s.awayTeam === 'Arsenal')).toBe(false);
    expect(bttsSignals.some((s) => s.homeTeam === 'Everton' && s.awayTeam === 'Arsenal')).toBe(false);
  });
});
