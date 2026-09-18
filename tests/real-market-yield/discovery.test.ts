import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DiscoveryArtifact } from '../../scripts/research/run-real-market-discovery';

describe('Real Market Yield — Discovery Phase Verification', () => {
  const discoveryPath = path.resolve(
    process.cwd(),
    'data/verification/REAL_MARKET_YIELD_DISCOVERY.json'
  );

  it('1. Verifies that discovery artifact exists and evaluated exactly 140 hypotheses', () => {
    expect(fs.existsSync(discoveryPath)).toBe(true);
    const content = fs.readFileSync(discoveryPath, 'utf-8');
    const discovery = JSON.parse(content) as DiscoveryArtifact;

    expect(discovery.datasetHash).toBe(
      '22e8e80a8d9c53aa878972bc42603d9b231fed709357c9d05cf8defc1ac1d727'
    );
    expect(discovery.familyHash).toBe(
      '05d8292c14066496f9b83226509536879d1becca8ebafa772370f0787115a2eb'
    );
    expect(discovery.totalHypothesesEvaluated).toBe(140);
    expect(discovery.allHypotheses.length).toBe(140);
  });

  it('2. Verifies candidate selection rule is deterministic and matches preregistration', () => {
    const content = fs.readFileSync(discoveryPath, 'utf-8');
    const discovery = JSON.parse(content) as DiscoveryArtifact;

    expect(discovery.candidateSelectionRule.minBets).toBe(50);
    expect(discovery.candidateSelectionRule.requirePositiveRoi).toBe(true);
    expect(discovery.candidateSelectionRule.maxRawPValue).toBe(0.05);
    expect(discovery.candidateSelectionRule.maxFdrQValue).toBe(0.10);

    // Verify candidate filtering logic
    for (const h of discovery.allHypotheses) {
      const shouldBeCandidate =
        h.betsCount >= 50 &&
        h.realizedRoi > 0 &&
        h.rawPValue <= 0.05 &&
        h.fdrAdjustedQValue <= 0.10;

      expect(h.isCandidate).toBe(shouldBeCandidate);
    }
  });

  it('3. Verifies that all candidates meet candidate selection rule', () => {
    const content = fs.readFileSync(discoveryPath, 'utf-8');
    const discovery = JSON.parse(content) as DiscoveryArtifact;

    expect(discovery.totalCandidatesDiscovered).toBe(discovery.candidates.length);
    expect(discovery.candidateIds.length).toBe(discovery.candidates.length);

    for (const c of discovery.candidates) {
      expect(c.betsCount).toBeGreaterThanOrEqual(50);
      expect(c.realizedRoi).toBeGreaterThan(0);
      expect(c.rawPValue).toBeLessThanOrEqual(0.05);
      expect(c.fdrPass).toBe(true);
    }
  });
});

