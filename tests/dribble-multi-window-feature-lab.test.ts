import { describe, it, expect } from 'vitest';
import { DribbleMultiWindowFeatureLab } from '@/lib/research/dribble/dribbleMultiWindowFeatureLab';

describe('DribbleMultiWindowFeatureLab Test Suite', () => {
  it('instantiates cleanly without errors', () => {
    const lab = new DribbleMultiWindowFeatureLab();
    expect(lab).toBeDefined();
    expect(typeof lab.initialize).toBe('function');
    expect(typeof lab.buildMultiWindowDataset).toBe('function');
  });

  it('correctly parses seasons from ISO dates', () => {
    const lab = new DribbleMultiWindowFeatureLab();
    // Access private method getSeason via any cast for testing
    const getSeason = (lab as any).getSeason.bind(lab);
    expect(getSeason('2024-08-15')).toBe('2024_2025');
    expect(getSeason('2025-01-10')).toBe('2024_2025');
    expect(getSeason('2025-05-24')).toBe('2024_2025');
    expect(getSeason('2025-08-12')).toBe('2025_2026');
  });

  it('correctly maps team slugs to whitelist leagues', () => {
    const lab = new DribbleMultiWindowFeatureLab();
    const identifyLeague = (lab as any).identifyLeague.bind(lab);
    expect(identifyLeague('arsenal', 'chelsea')).toBe('EPL');
    expect(identifyLeague('real-madrid', 'barcelona')).toBe('La Liga');
    expect(identifyLeague('inter', 'juventus')).toBe('Serie A');
    expect(identifyLeague('bayern-munich', 'borussia-dortmund')).toBe('Bundesliga');
    expect(identifyLeague('paris-saint-germain', 'marseille')).toBe('Ligue 1');
    expect(identifyLeague('ajax', 'psv')).toBe('Eredivisie');
    expect(identifyLeague('fenerbahce', 'galatasaray')).toBe('OTHER');
  });
});
