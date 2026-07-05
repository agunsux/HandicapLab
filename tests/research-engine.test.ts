import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsCalculator, ResearchEngineService, HypothesisModel, ExperimentModel } from '../src/lib/warehouse/metadata/researchEngine';
import { supabase } from '../src/lib/supabase.server';

describe('MetricsCalculator Formulas', () => {
  it('should calculate ROI and profit factor from bet matrices', () => {
    // 3 bets: stake 10 (win +10 net), stake 10 (lose -10 net), stake 10 (win +5 net)
    // Stakes: 10, 10, 10 -> total: 30
    // Returns: 20 (net 10), 0 (net -10), 15 (net 5) -> total returns: 35
    const stakes = [10, 10, 10];
    const returns = [20, 0, 15];

    const stats = MetricsCalculator.calculateRoi(stakes, returns);
    expect(stats.roi).toBeCloseTo(16.67, 1);
    // Wins: 10 + 5 = 15. Losses: 10. Profit factor = 1.5
    expect(stats.profitFactor).toBe(1.5);
  });

  it('should compute Kelly stakes and fractionals', () => {
    const stake = MetricsCalculator.calculateKelly(2.0, 0.55, 0.5); // (0.55 * 1 - 0.45)/1 = 0.10 * 0.5 fraction = 0.05
    expect(stake).toBe(0.05);
  });
});

describe('ResearchEngineService Transitions', () => {
  let service: ResearchEngineService;

  beforeEach(() => {
    service = new ResearchEngineService();

    // Mock supabase calls
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 1, status: 'draft' } }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockReturnThis()
    } as any);
  });

  it('should record audit trails on state transition calls', async () => {
    // Spy on logs table insert call
    const insertSpy = vi.spyOn(supabase, 'from');

    await service.transitionStatus('HYP-101', 'running', 'lead-researcher', 'Verify home advantage hypothesis');
    expect(insertSpy).toHaveBeenCalledWith('wh_research_audit_logs');
  });
});
