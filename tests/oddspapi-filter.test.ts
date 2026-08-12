import { describe, it, expect } from 'vitest';
import { filterOddsPapiBookmakers } from '@/lib/providers/oddspapiFilter';

describe('oddspapiFilter', () => {
  it('should filter out non-allowed bookmakers from single match response', () => {
    const response = {
      data: {
        id: '123',
        bookmakers: [
          { name: 'Pinnacle', odds: [] },
          { name: 'Bet365', odds: [] },
          { name: ' SboBet ', odds: [] },
          { name: 'SBO', odds: [] },
          { name: 'Unibet', odds: [] }
        ]
      }
    };

    const filtered = filterOddsPapiBookmakers(response);
    
    expect(filtered.data.bookmakers).toHaveLength(3);
    const names = filtered.data.bookmakers.map((b: any) => b.name.trim().toLowerCase());
    expect(names).toContain('pinnacle');
    expect(names).toContain('sbobet');
    expect(names).toContain('sbo');
    expect(names).not.toContain('bet365');
  });

  it('should handle array of matches', () => {
    const response = {
      data: [
        {
          bookmakers: [
            { name: 'pinnacle', odds: [] },
            { name: 'betway', odds: [] }
          ]
        },
        {
          bookmakers: [
            { name: '1xBet', odds: [] }
          ]
        }
      ]
    };

    const filtered = filterOddsPapiBookmakers(response);
    expect(filtered.data[0].bookmakers).toHaveLength(1);
    expect(filtered.data[0].bookmakers[0].name).toBe('pinnacle');
    expect(filtered.data[1].bookmakers).toHaveLength(0);
  });

  it('should safely handle missing bookmakers array', () => {
    const response = { data: { id: '123' } };
    const filtered = filterOddsPapiBookmakers(response);
    expect(filtered).toEqual(response);
  });

  it('should safely handle null/undefined inputs', () => {
    expect(filterOddsPapiBookmakers(null)).toBeNull();
    expect(filterOddsPapiBookmakers(undefined)).toBeUndefined();
    expect(filterOddsPapiBookmakers('string')).toBe('string');
  });
});
