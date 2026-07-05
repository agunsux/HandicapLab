import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResearchReadinessService, DatasetRegistryModel } from '../src/lib/warehouse/metadata/researchReadiness';
import { supabase } from '../src/lib/supabase.server';

describe('ResearchReadinessService Profiling Engine', () => {
  const service = new ResearchReadinessService();

  it('should calculate row counts and null values percentages', () => {
    const data = [
      { fixture_id: 1, status: 'finished', score: null },
      { fixture_id: 2, status: 'scheduled', score: null }
    ];

    const profile = service.profileData(data);
    expect(profile.rowCount).toBe(2);
    // 2 null fields out of 6 total fields = 33.33%
    expect(profile.nullPct).toBeCloseTo(33.33, 1);
  });

  it('should detect duplicate rows and flag outliers', () => {
    const data = [
      { fixture_id: 1, odds: 150.0 }, // Outlier
      { fixture_id: 1, odds: 150.0 }  // Duplicate
    ];

    const profile = service.profileData(data);
    expect(profile.duplicatePct).toBe(50.0);
    expect(profile.outliersCount).toBe(2); // Both rows contain odds = 150
  });
});

describe('Drift Detection & Registry Freezer', () => {
  let service: ResearchReadinessService;

  beforeEach(() => {
    service = new ResearchReadinessService();
  });

  it('should calculate schema and coverage shifts', () => {
    const source: DatasetRegistryModel = {
      datasetId: 'silver_fixtures',
      version: '1.0.0',
      sourceProvenance: 'api-football',
      coveragePct: 98.5,
      checksum: 'abc',
      schemaVersion: '1.0.0'
    };

    const target: DatasetRegistryModel = {
      datasetId: 'silver_fixtures',
      version: '1.1.0',
      sourceProvenance: 'api-football',
      coveragePct: 95.0,
      checksum: 'xyz',
      schemaVersion: '1.1.0' // Drifted
    };

    const drift = service.detectDrift(source, target);
    expect(drift.schemaDrift).toBe(true);
    expect(drift.coverageDrift).toBe(3.5);
  });

  it('should prevent modifications to frozen datasets', async () => {
    // Mock get indicating dataset is frozen
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 10, is_frozen: true } }),
      upsert: vi.fn().mockReturnThis()
    } as any);

    const model: DatasetRegistryModel = {
      datasetId: 'silver_fixtures',
      version: '1.0.0',
      sourceProvenance: 'api-football',
      coveragePct: 99.0,
      checksum: 'abc',
      schemaVersion: '1.0.0'
    };

    await expect(service.registerDataset(model)).rejects.toThrow('Cannot modify frozen dataset version');
  });
});
