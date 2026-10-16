import { describe, it, expect } from 'vitest';
import { Dribble360FixtureService } from '@/lib/data-platform/dribble360FixtureService';
import { Dribble360Adapter } from '@/lib/data-platform/dribble360Adapter';

describe('Dribble360FixtureService & Adapter Tests', () => {
  it('correctly maps season IDs to canonical league identifiers', () => {
    expect(Dribble360Adapter.resolveCompetitionId({ id: '1', season_id: '6pdwluctev9iebv00r4qqukno' })).toBe('ENG-PL');
    expect(Dribble360Adapter.resolveCompetitionId({ id: '2', season_id: '830epggffy1nfkfyrtpqdwhlg' })).toBe('ESP-LALIGA');
    expect(Dribble360Adapter.resolveCompetitionId({ id: '3', season_id: '8h5xijv2u4mlf5028gso6kw7o' })).toBe('DEU-BUNDESLIGA');
    expect(Dribble360Adapter.resolveCompetitionId({ id: '4', season_id: '60cryos85i4bp5ul34tt0brx0' })).toBe('ITA-SERIEA');
    expect(Dribble360Adapter.resolveCompetitionId({ id: '5', season_id: 'bqnc4ccgnrp6pb3bktqet0yz8' })).toBe('FRA-LIGUE1');
    expect(Dribble360Adapter.resolveCompetitionId({ id: '6', season_id: '99jev9kv55deht65t6myggxlg' })).toBe('UEFA-CL');
    expect(Dribble360Adapter.resolveCompetitionId({ id: '7', season_id: '1rpi0q64a7kut2wiuvecmgbv8' })).toBe('UEFA-EL');
    expect(Dribble360Adapter.resolveCompetitionId({ id: '8', season_id: 'acatl9aedc5l4im3r8l890y6s' })).toBe('UEFA-ECL');
  });

  it('normalizes team names deterministically', () => {
    expect(Dribble360Adapter.normalizeTeamName('Arsenal FC')).toBe('arsenal');
    expect(Dribble360Adapter.normalizeTeamName('Real Madrid C.F.')).toBe('real madrid');
    expect(Dribble360Adapter.normalizeTeamName('AFC Bournemouth')).toBe('bournemouth');
  });

  it('generates deterministic canonical fixture IDs', () => {
    const key1 = Dribble360Adapter.generateCanonicalKey(
      'ENG-PL',
      '2026/2027',
      '2026-10-17T11:30:00.000Z',
      'Everton',
      'Chelsea'
    );
    const key2 = Dribble360Adapter.generateCanonicalKey(
      'ENG-PL',
      '2026/2027',
      '2026-10-17T11:30:00.000Z',
      'Everton FC',
      'Chelsea FC'
    );
    expect(key1).toBe('ENG-PL|2026/2027|2026-10-17|everton|chelsea');
    expect(key2).toBe('ENG-PL|2026/2027|2026-10-17|everton|chelsea');
  });

  it('discovers and canonicalizes fixtures in the 7-day audit window', async () => {
    const report = await Dribble360FixtureService.discoverUpcomingFixtures({
      startDateIso: '2026-10-16T00:00:00.000Z',
      endDateIso: '2026-10-23T23:59:59.999Z',
    });

    expect(report.totalRecordsScanned).toBeGreaterThan(1000);
    expect(report.validUpcomingCount).toBeGreaterThan(50);
    expect(report.duplicateCount).toBe(0);

    // Verify UCL is present
    expect(report.perCompetition['UEFA-CL']).toBeDefined();
    expect(report.perCompetition['UEFA-CL'].validCount).toBeGreaterThanOrEqual(10);

    // Verify Big 5 are present
    expect(report.perCompetition['ENG-PL']).toBeDefined();
    expect(report.perCompetition['ESP-LALIGA']).toBeDefined();
    expect(report.perCompetition['DEU-BUNDESLIGA']).toBeDefined();
    expect(report.perCompetition['ITA-SERIEA']).toBeDefined();
    expect(report.perCompetition['FRA-LIGUE1']).toBeDefined();

    // Verify canonical format
    const sample = report.canonicalFixtures[0];
    expect(sample.provider).toBe('dribble360');
    expect(sample.status).toBe('SCHEDULED');
    expect(sample.match_id).toContain('|');
    expect(sample.checksum).toBeDefined();
  });
});
