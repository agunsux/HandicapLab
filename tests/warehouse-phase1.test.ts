import { describe, it, expect } from 'vitest';
import { providerRegistryManager } from '../src/lib/warehouse/providerRegistry';
import { canonicalEntityResolver } from '../src/lib/warehouse/entityResolver';
import { ingestPhase1Season } from '../src/scripts/ingestPhase1Core';

describe('Phase 1: Football Warehouse Core', () => {
  it('should initialize active providers in ProviderRegistryManager', () => {
    const activeProviders = providerRegistryManager.getActiveProviders();
    expect(activeProviders.length).toBeGreaterThanOrEqual(7);

    const footballData = providerRegistryManager.getProvider('football_data');
    expect(footballData).toBeDefined();
    expect(footballData?.name).toBe('Football-Data.co.uk');
  });

  it('should resolve provider-specific team aliases to canonical team IDs', () => {
    const manCityFd = canonicalEntityResolver.resolveTeamId('football_data', 'Man City');
    const manCityUs = canonicalEntityResolver.resolveTeamId('understat', 'Manchester City');
    const manCityElo = canonicalEntityResolver.resolveTeamId('club_elo', 'Manchester City FC');

    expect(manCityFd).toBe('tm-epl-001');
    expect(manCityUs).toBe('tm-epl-001');
    expect(manCityElo).toBe('tm-epl-001');

    const canonicalTeam = canonicalEntityResolver.getCanonicalTeam(manCityFd);
    expect(canonicalTeam?.canonicalName).toBe('Manchester City FC');
  });

  it('should generate fallback auto-UUID for unknown provider team names', () => {
    const unknownTeamId = canonicalEntityResolver.resolveTeamId('football_data', 'Unknown United FC');
    expect(unknownTeamId).toMatch(/^tm-auto-[a-f0-9]{12}$/);
  });

  it('should execute ingestion quality probe for season 2023-2024 with 100% coverage', async () => {
    const report = await ingestPhase1Season('2023-2024', 'EPL');
    expect(report.totalFixtures).toBe(380);
    expect(report.coveragePct).toBe(100);
    expect(report.providerHealthScore).toBeGreaterThanOrEqual(95);
  });
});
