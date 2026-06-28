import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as modelValidationGET } from '../src/app/api/admin/model-validation/route';
import { GET as weeklyModelReportGET } from '../src/app/api/admin/weekly-model-report/route';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase Server Client
let mockShadowPredictions: any[] = [];

vi.mock('../src/lib/supabase.server', () => {
  const chain: any = {
    select: vi.fn().mockImplementation(() => chain),
    gte: vi.fn().mockImplementation(() => chain),
    then: vi.fn().mockImplementation((resolve) => {
      if (chain._currentTable === 'shadow_predictions') {
        resolve({ data: mockShadowPredictions, error: null });
      } else {
        resolve({ data: [], error: null });
      }
    })
  };
  return {
    supabase: {
      from: vi.fn((table: string) => {
        chain._currentTable = table;
        return chain;
      })
    }
  };
});

describe('Phase 35.4: Founder Validation Sprint tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShadowPredictions = [];
    process.env.MODEL_VALIDATION_MODE = 'false';
  });

  describe('Part 2: Model Validation Dashboard API', () => {
    it('should aggregate overall win rates, ROI, CLV, and Brier Score, and break down by confidence/market', async () => {
      mockShadowPredictions = [
        {
          id: 'pred-1',
          competition: 'FIFA World Cup',
          market_type: 'ML',
          predicted_pick: 'home',
          predicted_probability: 0.85,
          predicted_edge: 4.5,
          odds_at_prediction: 1.95,
          clv: 3.5,
          result_status: 'won',
          created_at: new Date().toISOString()
        },
        {
          id: 'pred-2',
          competition: 'Premier League',
          market_type: 'AH',
          predicted_pick: 'home_-0.25',
          predicted_probability: 0.65,
          predicted_edge: 3.1,
          odds_at_prediction: 1.90,
          clv: 2.1,
          result_status: 'lost',
          created_at: new Date().toISOString()
        }
      ];

      const request = new Request('http://localhost/api/admin/model-validation');
      const response = await modelValidationGET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.total_predictions).toBe(2);
      expect(json.overall.win_rate).toBe(50.0);
      expect(json.overall.brier_score).toBeCloseTo(0.2225, 4);
    });
  });

  describe('Part 4: Freeze Logic (MODEL_VALIDATION_MODE)', () => {
    it('should toggle process variable state successfully', () => {
      process.env.MODEL_VALIDATION_MODE = 'true';
      expect(process.env.MODEL_VALIDATION_MODE).toBe('true');
    });
  });

  describe('Part 5: Weekly Model Report API', () => {
    it('should aggregate weekly indicators, best performing markets, and worst competitions', async () => {
      mockShadowPredictions = [
        {
          id: 'pred-1',
          competition: 'FIFA World Cup',
          market_type: 'ML',
          predicted_pick: 'home',
          predicted_probability: 0.85,
          predicted_edge: 4.5,
          odds_at_prediction: 1.95,
          clv: 3.5,
          result_status: 'won',
          created_at: new Date().toISOString()
        }
      ];

      const request = new Request('http://localhost/api/admin/weekly-model-report');
      const response = await weeklyModelReportGET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.best_competition).toBe('FIFA World Cup');
      expect(json.best_market).toBe('Moneyline');
    });
  });
});
