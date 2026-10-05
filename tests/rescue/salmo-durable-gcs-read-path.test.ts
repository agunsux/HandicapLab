// ============================================================================
// SALMO DURABLE GCS RESCUE LEDGER READ PATH TEST SUITE
// ============================================================================
// Location: tests/rescue/salmo-durable-gcs-read-path.test.ts
//
// Verification of Section 10 Test Gates:
// Test A — local ledger exists -> local path used, existing behavior preserved
// Test B — local ledger absent -> GCS fallback -> 414 records loaded
// Test C — local absent + GCS unavailable -> safe failure state (DATA_TEMPORARILY_UNAVAILABLE)
// Test D — malformed GCS ledger -> rejected -> safe failure
// Test E — cache TTL -> first request hits GCS, subsequent request hits cache
// Test F — modelVersion isolation -> respects modelVersion=poisson_v1_rescue
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GcsLedgerStorage } from '@/lib/pipeline/rescue/gcsLedgerStorage';
import { SalmoProductionSyncService } from '@/lib/salmo/salmoProductionSyncService';

describe('Durable Rescue Ledger GCS Read Path (Phase 2)', () => {
  const localLedgerPath = path.resolve(process.cwd(), 'data/ledger/rescue_prediction_ledger.jsonl');
  let realLedgerContent = '';

  beforeEach(() => {
    GcsLedgerStorage.clearMemoryCache();
    if (fs.existsSync(localLedgerPath)) {
      realLedgerContent = fs.readFileSync(localLedgerPath, 'utf8');
    }
    vi.restoreAllMocks();
  });

  afterEach(() => {
    GcsLedgerStorage.clearMemoryCache();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Test A: Local ledger exists -> local path used, existing behavior preserved
  // --------------------------------------------------------------------------
  it('Test A: reads local ledger when present and preserves 0-pick research semantics', async () => {
    const fetchSpy = vi.spyOn(GcsLedgerStorage, 'fetchFromGcs');

    const payload = await SalmoProductionSyncService.generateSyncPayloadAsync({
      modelVersion: 'poisson_v1_rescue',
      nowMs: new Date('2026-10-04T07:00:00Z').getTime(),
    });

    expect(payload.success).toBe(true);
    expect(payload.dataState).toBe('NO_QUALIFIED_PICKS');
    expect(payload.counts.totalArchived).toBeGreaterThanOrEqual(414);
    expect(payload.counts.dailyPicks).toBe(0);
    expect(payload.dailyPicks).toHaveLength(0);
    expect(payload.predictions?.length).toBeGreaterThanOrEqual(414);
    expect(payload.performance.modelVersion).toBe('poisson_v1_rescue');
    expect(payload.freshness.status).toBe('FRESH');
    // GCS fetch was NOT needed because local exists
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Test B: Local ledger absent -> GCS fallback -> 414 records loaded
  // --------------------------------------------------------------------------
  it('Test B: falls back to GCS durable storage when local filesystem has no ledger', async () => {
    // Simulate container environment where local ledger is absent
    const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (typeof p === 'string' && p.includes('rescue_prediction_ledger.jsonl')) {
        return false;
      }
      return true;
    });

    // Mock GCS durable object fetch returning the 414 canonical records
    const fetchSpy = vi.spyOn(GcsLedgerStorage, 'fetchFromGcs').mockResolvedValue({
      rawText: realLedgerContent,
      generation: '1791110269635409',
    });

    const payload = await SalmoProductionSyncService.generateSyncPayloadAsync({
      modelVersion: 'poisson_v1_rescue',
      nowMs: new Date('2026-10-04T07:00:00Z').getTime(),
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(payload.success).toBe(true);
    expect(payload.dataState).toBe('NO_QUALIFIED_PICKS');
    expect(payload.counts.totalArchived).toBe(414);
    expect(payload.counts.dailyPicks).toBe(0);
    expect(payload.dailyPicks).toHaveLength(0);
    expect(payload.predictions?.length).toBe(414);
    expect(payload.performance.modelVersion).toBe('poisson_v1_rescue');
    expect(payload.freshness.status).toBe('FRESH');
    expect(payload.syncChecksum).toMatch(/^[a-f0-9]{64}$/);
  });

  // --------------------------------------------------------------------------
  // Test C: Local absent + GCS unavailable -> safe failure (DATA_TEMPORARILY_UNAVAILABLE)
  // --------------------------------------------------------------------------
  it('Test C: returns DATA_TEMPORARILY_UNAVAILABLE when both local and GCS are unavailable', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (typeof p === 'string' && p.includes('rescue_prediction_ledger.jsonl')) {
        return false;
      }
      return true;
    });

    // Simulate network error / GCS unreachable
    vi.spyOn(GcsLedgerStorage, 'fetchFromGcs').mockResolvedValue(null);

    const payload = await SalmoProductionSyncService.generateSyncPayloadAsync({
      modelVersion: 'poisson_v1_rescue',
      nowMs: new Date('2026-10-04T07:00:00Z').getTime(),
    });

    expect(payload.success).toBe(false);
    expect(payload.dataState).toBe('DATA_TEMPORARILY_UNAVAILABLE');
    expect(payload.counts.totalArchived).toBe(0);
    expect(payload.counts.dailyPicks).toBe(0);
    expect(payload.predictions).toEqual([]);
    expect(payload.freshness.status).toBe('STALE');
  });

  // --------------------------------------------------------------------------
  // Test D: Malformed GCS ledger -> rejected -> safe failure
  // --------------------------------------------------------------------------
  it('Test D: rejects corrupted or malformed GCS ledger and safely fails', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (typeof p === 'string' && p.includes('rescue_prediction_ledger.jsonl')) {
        return false;
      }
      return true;
    });

    // 1. Corrupted JSON
    vi.spyOn(GcsLedgerStorage, 'fetchFromGcs').mockResolvedValue({
      rawText: '{"id": "invalid_json_line", "kickoff_utc": 12345\n{bad json}',
      generation: '1',
    });

    const corruptPayload = await SalmoProductionSyncService.generateSyncPayloadAsync({
      modelVersion: 'poisson_v1_rescue',
      nowMs: new Date('2026-10-04T07:00:00Z').getTime(),
    });
    expect(corruptPayload.success).toBe(false);
    expect(corruptPayload.dataState).toBe('DATA_TEMPORARILY_UNAVAILABLE');

    // 2. Missing required fields (Section 5 schema check)
    GcsLedgerStorage.clearMemoryCache();
    vi.spyOn(GcsLedgerStorage, 'fetchFromGcs').mockResolvedValue({
      rawText: '{"id": "p1", "model_version": "poisson_v1_rescue"}\n', // Missing kickoff_utc, market, confidence_tier
      generation: '2',
    });

    const schemaPayload = await SalmoProductionSyncService.generateSyncPayloadAsync({
      modelVersion: 'poisson_v1_rescue',
      nowMs: new Date('2026-10-04T07:00:00Z').getTime(),
    });
    expect(schemaPayload.success).toBe(false);
    expect(schemaPayload.dataState).toBe('DATA_TEMPORARILY_UNAVAILABLE');
  });

  // --------------------------------------------------------------------------
  // Test E: Cache TTL -> First request hits GCS, subsequent hits memory cache
  // --------------------------------------------------------------------------
  it('Test E: caches validated GCS rows in memory within TTL without refetching', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (typeof p === 'string' && p.includes('rescue_prediction_ledger.jsonl')) {
        return false;
      }
      return true;
    });

    const fetchSpy = vi.spyOn(GcsLedgerStorage, 'fetchFromGcs').mockResolvedValue({
      rawText: realLedgerContent,
      generation: '1791110269635409',
    });

    // First request -> cold cache -> hits GCS
    const p1 = await SalmoProductionSyncService.generateSyncPayloadAsync({
      modelVersion: 'poisson_v1_rescue',
      nowMs: new Date('2026-10-04T07:00:00Z').getTime(),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(p1.counts.totalArchived).toBe(414);

    // Second request within TTL -> warm cache -> GCS not called again
    const p2 = await SalmoProductionSyncService.generateSyncPayloadAsync({
      modelVersion: 'poisson_v1_rescue',
      nowMs: new Date('2026-10-04T07:00:10Z').getTime(),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(p2.counts.totalArchived).toBe(414);

    // Synchronous generateSyncPayload also benefits from warm cache!
    const pSync = SalmoProductionSyncService.generateSyncPayload({
      modelVersion: 'poisson_v1_rescue',
      nowMs: new Date('2026-10-04T07:00:20Z').getTime(),
    });
    expect(pSync.counts.totalArchived).toBe(414);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // Test F: Model version isolation
  // --------------------------------------------------------------------------
  it('Test F: isolates poisson_v1_rescue model version from other models', async () => {
    // When requesting poisson_v1_rescue, returns rescue payload
    const rescuePayload = await SalmoProductionSyncService.generateSyncPayloadAsync({
      modelVersion: 'poisson_v1_rescue',
      nowMs: new Date('2026-10-04T07:00:00Z').getTime(),
    });
    expect(rescuePayload.performance.modelVersion).toBe('poisson_v1_rescue');
    expect(rescuePayload.predictions?.every((p) => p.model_version === 'poisson_v1_rescue')).toBe(true);

    // Non-rescue model does not load rescue ledger
    const canonicalPayload = await SalmoProductionSyncService.generateSyncPayloadAsync({
      modelVersion: 'dixon-coles-v1.0',
      nowMs: new Date('2026-10-04T07:00:00Z').getTime(),
    });
    expect(canonicalPayload.performance.modelVersion).not.toBe('poisson_v1_rescue');
  });
});

