import { describe, it, expect, beforeEach } from 'vitest';
import { DribbleLiteQuotaGuard } from '@/lib/providers/dribbleLiteQuotaGuard';
import { Dribble360Adapter } from '@/lib/data-platform/dribble360Adapter';
import type { Dribble360Match, Dribble360TeamMatch } from '@/lib/providers/dribble360Provider';

describe('DribbleLiteQuotaGuard & Canonical Adapter Validation', () => {
  beforeEach(() => {
    // Reset to clean test budget of 10 requests
    DribbleLiteQuotaGuard.resetSimulation(10);
  });

  describe('Quota Guard Enforcement Rules', () => {
    it('initializes with specified monthly budget and 0 consumed', () => {
      const state = DribbleLiteQuotaGuard.getState();
      expect(state.plan).toBe('LITE');
      expect(state.monthlyBudget).toBe(10);
      expect(state.consumed).toBe(0);
      expect(state.reserved).toBe(0);
    });

    it('permits requests when remaining budget is sufficient', () => {
      const afford = DribbleLiteQuotaGuard.canAfford(1);
      expect(afford.allowed).toBe(true);
      expect(afford.remaining).toBe(10);
    });

    it('atomically reserves, confirms, and updates budget metrics', () => {
      const res = DribbleLiteQuotaGuard.reserve('/matches', 'test_harvest', 2);
      expect(res.ok).toBe(true);
      expect(res.budgetRemaining).toBe(8);

      let metrics = DribbleLiteQuotaGuard.getMetrics();
      expect(metrics.budget_reserved).toBe(2);
      expect(metrics.budget_consumed).toBe(0);
      expect(metrics.budget_remaining).toBe(8);

      DribbleLiteQuotaGuard.confirm(res.reservationId!, 2);
      metrics = DribbleLiteQuotaGuard.getMetrics();
      expect(metrics.budget_reserved).toBe(0);
      expect(metrics.budget_consumed).toBe(2);
      expect(metrics.budget_remaining).toBe(8);
    });

    it('rolls back reservation properly when request fails', () => {
      const res = DribbleLiteQuotaGuard.reserve('/matches', 'fail_test', 3);
      expect(res.ok).toBe(true);
      expect(DribbleLiteQuotaGuard.getMetrics().budget_remaining).toBe(7);

      DribbleLiteQuotaGuard.rollback(res.reservationId!);
      const metrics = DribbleLiteQuotaGuard.getMetrics();
      expect(metrics.budget_reserved).toBe(0);
      expect(metrics.budget_consumed).toBe(0);
      expect(metrics.budget_remaining).toBe(10);
    });

    it('strictly enforces hard STOP when simulated Lite budget is exhausted', () => {
      // Consume all 10 credits
      const res = DribbleLiteQuotaGuard.reserve('/matches', 'fill_budget', 10);
      expect(res.ok).toBe(true);
      DribbleLiteQuotaGuard.confirm(res.reservationId!, 10);

      const metrics = DribbleLiteQuotaGuard.getMetrics();
      expect(metrics.budget_consumed).toBe(10);
      expect(metrics.budget_remaining).toBe(0);

      // Now attempt 1 more request
      const afford = DribbleLiteQuotaGuard.canAfford(1);
      expect(afford.allowed).toBe(false);
      expect(afford.remaining).toBe(0);
      expect(afford.reason).toContain('LITE_BUDGET_EXHAUSTED');

      const rejectedRes = DribbleLiteQuotaGuard.reserve('/matches', 'should_be_blocked', 1);
      expect(rejectedRes.ok).toBe(false);
      expect(rejectedRes.reason).toContain('LITE_BUDGET_EXHAUSTED');
    });

    it('formats human-readable status box', () => {
      const box = DribbleLiteQuotaGuard.formatStatusBox();
      expect(box).toContain('Lite Simulation');
      expect(box).toContain('Plan:      LITE ($19/mo)');
      expect(box).toContain('Remaining:');
    });
  });

  describe('Dribble360 Canonical Adapter', () => {
    const sampleMatch: Dribble360Match = {
      id: 'drb_test_match_001',
      description: 'Arsenal vs Chelsea',
      league_name: 'Premier League',
      season: '2025/2026',
      date: '2025-10-15T19:00:00.000Z',
      home_score: 2,
      away_score: 1,
      status: 'FINISHED',
      expected_goals_home: 1.85,
      expected_goals_away: 0.95,
    };

    const sampleTeamMatches: Dribble360TeamMatch[] = [
      {
        id: 'tm_home',
        match_id: 'drb_test_match_001',
        side: 'HOME',
        team_name: 'Arsenal',
        expected_goals: 1.85,
        expected_goals_conceded: 0.95,
        shots: 14,
        shots_on_target: 6,
        corner_taken: 5,
        fk_foul_lost: 9,
        yellow_cards: 1,
        red_cards: 0,
        att_bx_centre: 4, // Raw Opta field that must not leak
      },
      {
        id: 'tm_away',
        match_id: 'drb_test_match_001',
        side: 'AWAY',
        team_name: 'Chelsea',
        expected_goals: 0.95,
        expected_goals_conceded: 1.85,
        shots: 8,
        shots_on_target: 3,
        corner_taken: 4,
        fk_foul_lost: 11,
        yellow_cards: 2,
        red_cards: 0,
      },
    ];

    it('normalizes team names deterministically', () => {
      expect(Dribble360Adapter.normalizeTeamName('Arsenal FC')).toBe('arsenal');
      expect(Dribble360Adapter.normalizeTeamName('Chelsea AFC')).toBe('chelsea');
      expect(Dribble360Adapter.normalizeTeamName('Real Madrid C.F.')).toBe('real madrid');
    });

    it('generates consistent canonical fixture DTO', () => {
      const canonical = Dribble360Adapter.toCanonicalFixture(sampleMatch, sampleTeamMatches);
      expect(canonical.provider).toBe('dribble360');
      expect(canonical.provider_id).toBe('drb_test_match_001');
      expect(canonical.competition_id).toBe('ENG-PL');
      expect(canonical.home_goals).toBe(2);
      expect(canonical.away_goals).toBe(1);
      expect(canonical.home_xg).toBe(1.85);
      expect(canonical.away_xg).toBe(0.95);
      expect(canonical.home_shots).toBe(14);
      expect(canonical.away_shots).toBe(8);
      expect(canonical.home_shots_on_target).toBe(6);
      expect(canonical.away_shots_on_target).toBe(3);
      expect(canonical.status).toBe('FINISHED');
      expect(canonical.checksum).toBeDefined();
    });

    it('sanitizes and isolates team stats without leaking internal Opta fields', () => {
      const stats = Dribble360Adapter.toCanonicalTeamStats(sampleTeamMatches[0], 'cm_fixture_1');
      expect(stats.teamName).toBe('Arsenal');
      expect(stats.shots).toBe(14);
      expect(stats.shotsOnTarget).toBe(6);
      expect(stats.corners).toBe(5);
      expect(stats.yellowCards).toBe(1);
      expect(stats.redCards).toBe(0);

      // Verify no leak of Opta raw internals
      const keys = Object.keys(stats);
      expect(keys).not.toContain('att_bx_centre');
      expect(keys).not.toContain('att_obxd_left');
      expect(keys).not.toContain('optasports');
    });
  });
});
