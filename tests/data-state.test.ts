import { describe, it, expect } from 'vitest';
import { deriveDataState, DATA_STATE_LABEL, isDisplayableDataState } from '@/lib/data/dataState';

describe('dataState — canonical data labelling', () => {
  it('returns DATA_UNAVAILABLE when no real data exists', () => {
    expect(deriveDataState({ hasData: false })).toBe('DATA_UNAVAILABLE');
  });

  it('returns DATA_UPDATE_PAUSED when quota protection is active', () => {
    expect(
      deriveDataState({ hasData: true, sampleSize: 100, providerStatus: 'QUOTA_EXHAUSTED' })
    ).toBe('DATA_UPDATE_PAUSED');
    expect(
      deriveDataState({ hasData: false, providerStatus: 'QUOTA_INFRA_UNAVAILABLE' })
    ).toBe('DATA_UPDATE_PAUSED');
  });

  it('returns STALE when the provider is unavailable but cached data exists', () => {
    expect(deriveDataState({ hasData: true, providerStatus: 'PROVIDER_UNAVAILABLE' })).toBe('STALE');
  });

  it('returns INSUFFICIENT_DATA below the minimum sample', () => {
    expect(deriveDataState({ hasData: true, sampleSize: 5, minSample: 30 })).toBe('INSUFFICIENT_DATA');
  });

  it('returns STALE when data exceeds its freshness budget', () => {
    expect(
      deriveDataState({ hasData: true, sampleSize: 100, ageMs: 7_200_000, maxAgeMs: 3_600_000 })
    ).toBe('STALE');
  });

  it('returns CACHED for fresh cache hits and REAL otherwise', () => {
    expect(deriveDataState({ hasData: true, sampleSize: 100, fromCache: true })).toBe('CACHED');
    expect(deriveDataState({ hasData: true, sampleSize: 100 })).toBe('REAL');
  });

  it('exposes UI labels and displayability', () => {
    expect(DATA_STATE_LABEL.DATA_UPDATE_PAUSED).toBe('DATA UPDATE PAUSED');
    expect(isDisplayableDataState('DATA_UNAVAILABLE')).toBe(false);
    expect(isDisplayableDataState('REAL')).toBe(true);
  });
});
