import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { StrictWalkForwardAdapter } from '../../src/lib/research/real-yield/walkForwardAdapter';

describe('Real Market Yield — Dataset Integrity & Governance', () => {
  const FROZEN_DATASET_HASH = '22e8e80a8d9c53aa878972bc42603d9b231fed709357c9d05cf8defc1ac1d727';
  const FROZEN_AH_MODEL_A_HASH = 'ddf1c5c82272e78ac8f59082f25bb070e38d55e5d81faabab491daff731f014c';

  function computeSha256(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  it('1. Verifies frozen Gold dataset combined checksum', () => {
    const { combinedHash } = StrictWalkForwardAdapter.verifyFrozenGoldChecksum();
    expect(combinedHash).toBe(FROZEN_DATASET_HASH);
  });

  it('2. Asserts data/verification/AH_MODEL_A_RESULTS.json remains strictly byte-identical', () => {
    const ahResultsPath = path.resolve(process.cwd(), 'data/verification/AH_MODEL_A_RESULTS.json');
    const hash = computeSha256(ahResultsPath);
    expect(hash.toLowerCase()).toBe(FROZEN_AH_MODEL_A_HASH.toLowerCase());
  });

  it('3. Throws if frozen gold checksum is modified or corrupted', () => {
    expect(() => {
      // Intentionally verify with a non-existent or dummy file to test fail-closed behavior
      StrictWalkForwardAdapter.verifyFrozenGoldChecksum('package.json', 'package.json');
    }).toThrow(/\[LEAKAGE_INTEGRITY_BLOCK\]/);
  });
});

