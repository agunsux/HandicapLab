import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkImportService } from '../backend/services/BulkImportService';
import { supabase } from '../src/lib/supabase.server';
import * as fs from 'fs';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    readdirSync: vi.fn().mockImplementation((pathStr: string) => {
      if (pathStr.endsWith('football-data')) {
        return ['EPL', 'LaLiga'];
      }
      if (pathStr.endsWith('EPL')) {
        return ['2025-2026.csv', '2015-2016.csv']; // Unsorted list
      }
      return [];
    }),
    statSync: vi.fn().mockReturnValue({ isDirectory: () => true }),
    readFileSync: vi.fn().mockReturnValue(`Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H,B365D,B365A,PSH,PSD,PSA,HS,AS
E0,2026-07-01,15:00,Man United,Liverpool,2,1,H,2.10,3.40,3.20,2.15,3.35,3.15,12,8`)
  };
});

describe('BulkImportService Chronological Sorting & Checkpoints', () => {
  let service: BulkImportService;

  beforeEach(() => {
    service = new BulkImportService();
    vi.clearAllMocks();
  });

  it('should scan directories and sort seasons chronologically', () => {
    const list = service.scanAndSort();
    
    // 2015-2016 should come before 2025-2026
    expect(list.length).toBe(2);
    expect(list[0].season).toBe('2015-2016');
    expect(list[1].season).toBe('2025-2026');
  });

  it('should skip ingestion of completed seasons via checkpoints', async () => {
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 10, status: 'completed' }, error: null })
    } as any);

    const summary = await service.executeBulk();
    expect(summary.totalSeasons).toBe(0); // Both EPL seasons skipped since they are 'completed'
  });
});
