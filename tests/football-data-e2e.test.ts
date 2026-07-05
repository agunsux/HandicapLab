import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from '../backend/services/ImportService';
import { supabase } from '../src/lib/supabase.server';

const mockCsv = `Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H,B365D,B365A,PSH,PSD,PSA,HS,AS
E0,2026-07-01,15:00,Man United,Liverpool,2,1,H,2.10,3.40,3.20,2.15,3.35,3.15,12,8`;

describe('Football-Data E2E Ingestion Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    let fixtureQueryCount = 0;
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      let mockData: any = { id: 1 };
      if (table === 'wh_fixtures') {
        fixtureQueryCount++;
        // On first run, return null (to trigger insert). On second run, return { id: 1 } (duplicate)
        mockData = fixtureQueryCount === 1 ? null : { id: 1 };
      }
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 1 } }),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockData, error: null })
      } as any;
    });
  });

  it('should run end-to-end import pipeline and assert counts', async () => {
    const service = new ImportService();
    
    // First Import
    const report1 = await service.processCSV(mockCsv);
    expect(report1.matchesImported).toBe(1);
    expect(report1.duplicateRows).toBe(0);

    // Second Import (should trigger idempotency skip)
    const report2 = await service.processCSV(mockCsv);
    expect(report2.matchesImported).toBe(0);
    expect(report2.duplicateRows).toBe(1);
  });
});
