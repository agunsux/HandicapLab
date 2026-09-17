import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  PreregistrationBuilder,
  RealMarketYieldPreregistration,
} from '../../src/lib/research/real-yield/preregistration';

describe('Real Market Yield — Preregistration Integrity & Tamper Detection', () => {
  const artifactPath = path.resolve(
    process.cwd(),
    'data/verification/REAL_MARKET_YIELD_PREREGISTRATION.json'
  );

  it('1. Verifies that committed preregistration exists and matches familyHash', () => {
    expect(fs.existsSync(artifactPath)).toBe(true);
    const content = fs.readFileSync(artifactPath, 'utf-8');
    const prereg = JSON.parse(content) as RealMarketYieldPreregistration;

    expect(prereg.datasetHash).toBe(
      '22e8e80a8d9c53aa878972bc42603d9b231fed709357c9d05cf8defc1ac1d727'
    );
    expect(prereg.bookmaker).toBe('pinnacle');
    expect(prereg.priceObservation).toBe('opening');
    expect(prereg.selectionRule.minEvThreshold).toBe(0.02);
    expect(prereg.selectionRule.stakeUnit).toBe(1.0);
    expect(prereg.minimumConfirmationBets).toBe(200);
    expect(prereg.multipleTesting.fdrQ).toBe(0.10);
    expect(prereg.familySize).toBe(140);
    expect(prereg.hypotheses.length).toBe(140);

    // Recompute familyHash from content
    const { familyHash, ...basePayload } = prereg;
    const computedHash = PreregistrationBuilder.computeFamilyHash(basePayload as any);
    expect(computedHash).toBe(familyHash);
  });

  it('2. Detects any parameter tampering: modified threshold changes hash', () => {
    const content = fs.readFileSync(artifactPath, 'utf-8');
    const prereg = JSON.parse(content) as RealMarketYieldPreregistration;

    const { familyHash, ...basePayload } = prereg;
    // Tamper minEvThreshold
    const tamperedPayload = {
      ...basePayload,
      selectionRule: {
        ...basePayload.selectionRule,
        minEvThreshold: 0.05, // TAMPERED!
      },
    };

    const tamperedHash = PreregistrationBuilder.computeFamilyHash(tamperedPayload as any);
    expect(tamperedHash).not.toBe(familyHash);
  });

  it('3. Detects period tampering: modified discovery or confirmation split changes hash', () => {
    const content = fs.readFileSync(artifactPath, 'utf-8');
    const prereg = JSON.parse(content) as RealMarketYieldPreregistration;

    const { familyHash, ...basePayload } = prereg;
    // Tamper discovery period
    const tamperedPayload = {
      ...basePayload,
      discoveryPeriod: ['2015-2016', '2016-2017'], // TAMPERED!
    };

    const tamperedHash = PreregistrationBuilder.computeFamilyHash(tamperedPayload as any);
    expect(tamperedHash).not.toBe(familyHash);
  });

  it('4. Verifies all 140 hypotheses have strictly unique IDs and valid odds constraints', () => {
    const content = fs.readFileSync(artifactPath, 'utf-8');
    const prereg = JSON.parse(content) as RealMarketYieldPreregistration;

    const ids = new Set<string>();
    for (const h of prereg.hypotheses) {
      expect(ids.has(h.id)).toBe(false); // No duplicates
      ids.add(h.id);

      expect(h.minOdds).toBeGreaterThanOrEqual(1.20);
      expect(h.maxOdds).toBeLessThanOrEqual(20.00);
      expect(h.minOdds).toBeLessThan(h.maxOdds);
    }
    expect(ids.size).toBe(140);
  });
});
