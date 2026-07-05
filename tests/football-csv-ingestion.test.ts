import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FootballDataParser } from '../backend/providers/football-data/FootballDataParser';
import { BookmakerNormalizer } from '../backend/providers/football-data/bookmakerNormalizer';
import { TeamAliasResolver } from '../backend/providers/football-data/teamAliasResolver';
import { ValidationService } from '../backend/services/ValidationService';
import { FootballDataImporter } from '../backend/providers/football-data/FootballDataImporter';
import { supabase } from '../src/lib/supabase.server';

const mockCsv = `Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H,B365D,B365A,PSH,PSD,PSA,HS,AS
E0,2026-07-01,15:00,Man United,Liverpool,2,1,H,2.10,3.40,3.20,2.15,3.35,3.15,12,8
E0,2026-07-02,15:00,Man City,Arsenal,1,1,D,2.00,3.50,3.30,2.05,3.45,3.25,14,10`;

describe('FootballDataParser Headers & Mapping', () => {
  it('should parse CSV columns correctly and map to canonical match structure', () => {
    const parser = new FootballDataParser();
    const result = parser.parse(mockCsv);

    expect(result.length).toBe(2);
    expect(result[0].homeTeam).toBe('Manchester United'); // Resolved alias
    expect(result[0].league).toBe('Premier League'); // Resolved alias
    expect(result[0].markets['Bet365']['1X2_Home'].price).toBe(2.10);
  });

  it('should fail fast on missing required headers', () => {
    const brokenCsv = `Div,Date,Time,HomeTeam,AwayTeam,FTR
E0,2026-07-01,15:00,Man United,Liverpool,H`;

    const parser = new FootballDataParser();
    expect(() => parser.parse(brokenCsv)).toThrow(/Missing required header/);
  });
});

describe('Bookmaker & Team Normalizers', () => {
  it('should translate shortcodes to standardized values', () => {
    expect(BookmakerNormalizer.normalize('B365')).toBe('Bet365');
    expect(BookmakerNormalizer.normalize('PS')).toBe('Pinnacle');
    expect(TeamAliasResolver.resolve('Man United')).toBe('Manchester United');
  });
});

describe('ValidationService Bounds Checker', () => {
  const service = new ValidationService();

  it('should flag validation errors on negative goal values', () => {
    const mockMatches: any[] = [
      {
        metadata: { rowNumber: 1 },
        statistics: { goals: { home: -1, away: 2 } },
        markets: {}
      }
    ];

    const report = service.validate(mockMatches);
    expect(report.isValid).toBe(false);
    expect(report.errors[0].reason).toContain('Goals count cannot be negative');
  });
});

describe('FootballDataImporter Staging Database Logs', () => {
  let importer: FootballDataImporter;

  beforeEach(() => {
    importer = new FootballDataImporter();
    vi.clearAllMocks();

    vi.spyOn(supabase, 'from').mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 1 } }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    } as any);
  });

  it('should run ETL loop staging match statistics and odds logs', async () => {
    const summary = await importer.importCSV(mockCsv);

    expect(summary.matchesImported).toBe(2);
    expect(summary.oddsImported).toBe(12); // 2 matches * 3 Bet365 + 3 Pinnacle selections
  });
});
