import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Forensic Data Provenance & Source Lineage Gate', () => {
  const bronze2425Path = path.resolve(process.cwd(), 'data', 'bronze', 'football_data', '2024-2025.csv');
  const bronze2526Path = path.resolve(process.cwd(), 'data', 'bronze', 'football_data', '2025-2026.csv');
  const goldenPath = path.resolve(process.cwd(), 'data', 'golden', 'europe', 'canonical_matches.jsonl');

  it('1. Raw bronze source CSV files exist and are readable', () => {
    expect(fs.existsSync(bronze2425Path)).toBe(true);
    expect(fs.existsSync(bronze2526Path)).toBe(true);
    expect(fs.existsSync(goldenPath)).toBe(true);
  });

  it('2. Source CSV contains verified Pinnacle Asian Handicap columns', () => {
    const header2425 = fs.readFileSync(bronze2425Path, 'utf8').split('\n')[0].split(',');
    const header2526 = fs.readFileSync(bronze2526Path, 'utf8').split('\n')[0].split(',');

    // Opening Pinnacle Asian Handicap
    expect(header2425).toContain('PAHH');
    expect(header2425).toContain('PAHA');
    expect(header2425).toContain('AHh');

    // Closing Pinnacle Asian Handicap
    expect(header2425).toContain('PCAHH');
    expect(header2425).toContain('PCAHA');
    expect(header2425).toContain('AHCh');

    expect(header2526).toContain('PAHH');
    expect(header2526).toContain('PAHA');
    expect(header2526).toContain('AHh');
    expect(header2526).toContain('PCAHH');
    expect(header2526).toContain('PCAHA');
    expect(header2526).toContain('AHCh');
  });

  it('3. Reconciles exact fixture counts (380 in 2024/25 + 380 in 2025/26 = 760 total)', () => {
    const lines2425 = fs.readFileSync(bronze2425Path, 'utf8').trim().split('\n').slice(1);
    const lines2526 = fs.readFileSync(bronze2526Path, 'utf8').trim().split('\n').slice(1);

    expect(lines2425.length).toBe(380);
    expect(lines2526.length).toBe(380);

    const goldenLines = fs.readFileSync(goldenPath, 'utf8').trim().split('\n');
    const plMatches = goldenLines.map((l) => JSON.parse(l)).filter((m) => m.leagueId === 'ENG-PL' && (m.season === '2024-2025' || m.season === '2025-2026'));
    expect(plMatches.length).toBe(760);
  });

  it('4. Asserts full-time score presence (zero missing scores across all 760 fixtures)', () => {
    const goldenLines = fs.readFileSync(goldenPath, 'utf8').trim().split('\n');
    const plMatches = goldenLines.map((l) => JSON.parse(l)).filter((m) => m.leagueId === 'ENG-PL' && (m.season === '2024-2025' || m.season === '2025-2026'));

    for (const m of plMatches) {
      expect(m.homeGoals).not.toBeNull();
      expect(m.awayGoals).not.toBeNull();
      expect(typeof m.homeGoals).toBe('number');
      expect(typeof m.awayGoals).toBe('number');
      expect(['H', 'D', 'A']).toContain(m.result);
    }
  });

  it('5. Verifies decimal odds validity (odds > 1.0 for all populated Pinnacle AH prices)', () => {
    const goldenLines = fs.readFileSync(goldenPath, 'utf8').trim().split('\n');
    const plMatches = goldenLines.map((l) => JSON.parse(l)).filter((m) => m.leagueId === 'ENG-PL' && (m.season === '2024-2025' || m.season === '2025-2026'));

    let validAhCount = 0;
    for (const m of plMatches) {
      if (m.odds && m.odds.ahLine !== undefined && m.odds.ahHome && m.odds.ahAway) {
        expect(m.odds.ahHome).toBeGreaterThan(1.0);
        expect(m.odds.ahAway).toBeGreaterThan(1.0);
        validAhCount++;
      }
    }
    expect(validAhCount).toBe(759); // 759 out of 760 fixtures have complete Pinnacle AH pairs
  });
});
