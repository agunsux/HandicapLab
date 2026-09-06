import { describe, it, expect } from 'vitest';
import {
  classifySignal,
  filterForPublicFeed,
  isPriorityLeague,
  isWhitelistedLeague,
  SIGNAL_CLASSIFIER_VERSION,
} from '../src/lib/signals/signalClassifier';
import {
  getUnitValue,
  unitsToCurrency,
  currencyToUnits,
  calculateScaledKellyUnits,
  DEFAULT_BANKROLL_SETTINGS,
} from '../src/lib/risk/bankrollModel';
import {
  settleAsianHandicap,
  settleOverUnder,
  settleBtts,
  settle,
} from '../src/lib/settlement-core/settlement';
import { API_COST_REGISTRY } from '../src/lib/providers/quotaManagerV4';

describe('PRODUCTION OPERATING MODEL - DAY 0 VERIFICATION SUITE', () => {

  // ==========================================================================
  // TEST B: TRAFFIC LIGHT SIGNAL CLASSIFICATION
  // ==========================================================================
  describe('Test B: Traffic Light Signal Classifier', () => {
    it('classifies as GREEN when Edge >= 5%, N >= 30, and Confidence >= 60%', () => {
      // Model prob = 58%, Odds = 1.95 -> Edge = (0.58 * 1.95) - 1 = +13.1%
      const signal = classifySignal({
        market: 'AH',
        selection: 'Arsenal -0.75',
        modelProbability: 0.58,
        marketOdds: 1.95,
        sampleSize: 45,
        confidence: 75,
        leagueId: 39,
        leagueName: 'Premier League',
        kickoffUtc: '2026-09-06T14:00:00Z',
      });

      expect(signal.color).toBe('GREEN');
      expect(signal.edgePct).toBeGreaterThanOrEqual(5.0);
      expect(signal.isPubliclyVisible).toBe(true);
      expect(signal.publicVisibilityReason).toBe('QUALIFIED_GREEN_SIGNAL');
      expect(signal.rejectionReason).toBeNull();
    });

    it('classifies as YELLOW when edge is positive (>= 0%) but sample size is moderate (10 <= N < 30)', () => {
      // Model prob = 52%, Odds = 2.00 -> Edge = 4%
      const signal = classifySignal({
        market: 'OU',
        selection: 'Over 2.5',
        modelProbability: 0.52,
        marketOdds: 2.00,
        sampleSize: 18,
        confidence: 55,
        leagueId: 39,
        leagueName: 'Premier League',
        kickoffUtc: '2026-09-06T14:00:00Z',
      });

      expect(signal.color).toBe('YELLOW');
      expect(signal.edgePct).toBeGreaterThanOrEqual(0.0);
      expect(signal.rejectionReason).toBe('SUB_OPTIMAL_SAMPLE_SIZE');
    });

    it('classifies as RED when expected edge is negative (< 0%)', () => {
      // Model prob = 45%, Odds = 2.00 -> Edge = -10.0%
      const signal = classifySignal({
        market: 'BTTS',
        selection: 'Yes',
        modelProbability: 0.45,
        marketOdds: 2.00,
        sampleSize: 50,
        confidence: 70,
        leagueId: 140,
        leagueName: 'La Liga',
        kickoffUtc: '2026-09-06T18:00:00Z',
      });

      expect(signal.color).toBe('RED');
      expect(signal.edgePct).toBeLessThan(0);
      expect(signal.rejectionReason).toBe('NEGATIVE_EXPECTED_VALUE');
    });

    it('classifies as RED when sample size N < 10 regardless of edge', () => {
      const signal = classifySignal({
        market: 'AH',
        selection: 'Real Madrid -1.0',
        modelProbability: 0.70,
        marketOdds: 2.00,
        sampleSize: 5,
        confidence: 80,
        leagueId: 140,
        leagueName: 'La Liga',
        kickoffUtc: '2026-09-06T18:00:00Z',
      });

      expect(signal.color).toBe('RED');
      expect(signal.rejectionReason).toBe('INSUFFICIENT_SAMPLE_SIZE');
    });

    it('never fabricates green signals when criteria are not met', () => {
      const edgeTooSmall = classifySignal({
        market: 'AH',
        selection: 'Chelsea -0.25',
        modelProbability: 0.51,
        marketOdds: 2.00, // Edge = 2% (< 5%)
        sampleSize: 60,
        confidence: 70,
        leagueId: 39,
        kickoffUtc: '2026-09-06T15:00:00Z',
      });
      expect(edgeTooSmall.color).not.toBe('GREEN');
      expect(edgeTooSmall.color).toBe('YELLOW');
    });
  });

  // ==========================================================================
  // TEST C: DISPLAY POLICY & PRIORITY LEAGUES
  // ==========================================================================
  describe('Test C: Display Policy & Priority Whitelist', () => {
    it('identifies Big 5 leagues + Eredivisie as Priority Leagues', () => {
      expect(isPriorityLeague(39, 'Premier League')).toBe(true);
      expect(isPriorityLeague(140, 'La Liga')).toBe(true);
      expect(isPriorityLeague(135, 'Serie A')).toBe(true);
      expect(isPriorityLeague(78, 'Bundesliga')).toBe(true);
      expect(isPriorityLeague(61, 'Ligue 1')).toBe(true);
      expect(isPriorityLeague(88, 'Eredivisie')).toBe(true);
      expect(isPriorityLeague(999, 'Obscure League')).toBe(false);
    });

    it('filters for public feed: Green everywhere, Yellow/Red only for priority leagues', () => {
      const candidateSignals = [
        { id: 1, color: 'GREEN' as const, leagueId: 999, leagueName: 'Random League' },
        { id: 2, color: 'YELLOW' as const, leagueId: 999, leagueName: 'Random League' },
        { id: 3, color: 'RED' as const, leagueId: 999, leagueName: 'Random League' },
        { id: 4, color: 'YELLOW' as const, leagueId: 39, leagueName: 'Premier League' },
        { id: 5, color: 'RED' as const, leagueId: 88, leagueName: 'Eredivisie' },
      ];

      const visible = filterForPublicFeed(candidateSignals);
      const visibleIds = visible.map((s) => s.id);

      // Random league Yellow and Red must be excluded from public feed
      expect(visibleIds).toContain(1); // GREEN random league is allowed
      expect(visibleIds).not.toContain(2); // YELLOW random excluded
      expect(visibleIds).not.toContain(3); // RED random excluded
      expect(visibleIds).toContain(4); // YELLOW priority league is allowed
      expect(visibleIds).toContain(5); // RED priority league is allowed
    });
  });

  // ==========================================================================
  // TEST E: BANKROLL & 1-UNIT RISK SIZING
  // ==========================================================================
  describe('Test E: Bankroll & Unit Sizing Model', () => {
    it('computes 1u dynamically based on total bankroll and risk percentage', () => {
      const bankroll = 10000;
      // 2% default risk
      expect(getUnitValue(bankroll, 0.02)).toBe(200.0);
      // 1% minimum risk
      expect(getUnitValue(bankroll, 0.01)).toBe(100.0);
      // 5% maximum risk
      expect(getUnitValue(bankroll, 0.05)).toBe(500.0);
    });

    it('strictly clamps unit risk percentage between 1% and 5%', () => {
      const bankroll = 10000;
      // Below 1% is clamped to 1%
      expect(getUnitValue(bankroll, 0.001)).toBe(100.0);
      // Above 5% is clamped to 5%
      expect(getUnitValue(bankroll, 0.20)).toBe(500.0);
    });

    it('accurately translates units to currency and currency to units', () => {
      const bankroll = 10000;
      const riskPct = 0.02; // 1u = $200
      expect(unitsToCurrency(2.5, bankroll, riskPct)).toBe(500.0);
      expect(unitsToCurrency(-1.0, bankroll, riskPct)).toBe(-200.0);
      expect(currencyToUnits(400, bankroll, riskPct)).toBe(2.0);
    });

    it('calculates scaled Kelly units respecting unit ceiling', () => {
      // Prob = 0.58, Odds = 2.0 -> Full Kelly = 0.16 -> Quarter Kelly = 0.04
      // 4% of bankroll = 2 units (at 2% risk/unit)
      const units = calculateScaledKellyUnits(0.58, 2.0, 0.25, 2.5);
      expect(units).toBeGreaterThanOrEqual(0.25);
      expect(units).toBeLessThanOrEqual(2.5);
    });
  });

  // ==========================================================================
  // TEST F: SETTLEMENT ENGINE ACCURACY
  // ==========================================================================
  describe('Test F: Settlement Engine Pure Functions', () => {
    it('settles Asian Handicap quarter-lines and half-lines correctly', () => {
      // Home -0.25 on 2-1 (Home won by 1) -> Full WIN
      const winAh = settleAsianHandicap(2, 1, -0.25, 'home', 1.95);
      expect(winAh.outcome).toBe('WIN');
      expect(winAh.profitUnits).toBe(0.95);

      // Home -0.25 on 1-1 (Draw) -> HALF_LOSS (-0.5u)
      const halfLossAh = settleAsianHandicap(1, 1, -0.25, 'home', 1.95);
      expect(halfLossAh.outcome).toBe('HALF_LOSS');
      expect(halfLossAh.profitUnits).toBe(-0.5);

      // Home +0.25 on 1-1 (Draw) -> HALF_WIN (+0.5 * (1.95 - 1) = +0.475u)
      const halfWinAh = settleAsianHandicap(1, 1, 0.25, 'home', 1.95);
      expect(halfWinAh.outcome).toBe('HALF_WIN');
      expect(halfWinAh.profitUnits).toBe(0.475);

      // Home 0.0 on 1-1 (Draw) -> PUSH (0u)
      const pushAh = settleAsianHandicap(1, 1, 0.0, 'home', 1.95);
      expect(pushAh.outcome).toBe('PUSH');
      expect(pushAh.profitUnits).toBe(0);
    });

    it('settles Over/Under quarter-lines correctly', () => {
      // Over 2.75 on 3 goals (2-1) -> HALF_WIN
      const ouHalfWin = settleOverUnder(2, 1, 2.75, 'over', 2.00);
      expect(ouHalfWin.outcome).toBe('HALF_WIN');
      expect(ouHalfWin.profitUnits).toBe(0.5);

      // Over 2.75 on 2 goals (1-1) -> LOSS (-1u)
      const ouLoss = settleOverUnder(1, 1, 2.75, 'over', 2.00);
      expect(ouLoss.outcome).toBe('LOSS');
      expect(ouLoss.profitUnits).toBe(-1);
    });

    it('settles Both Teams To Score (BTTS) correctly', () => {
      // BTTS Yes on 2-1 -> WIN
      const bttsWin = settleBtts(2, 1, 'yes', 1.80);
      expect(bttsWin.outcome).toBe('WIN');
      expect(bttsWin.profitUnits).toBe(0.8);

      // BTTS Yes on 2-0 -> LOSS
      const bttsLoss = settleBtts(2, 0, 'yes', 1.80);
      expect(bttsLoss.outcome).toBe('LOSS');
      expect(bttsLoss.profitUnits).toBe(-1);

      // BTTS No on 2-0 -> WIN
      const bttsNoWin = settleBtts(2, 0, 'no', 2.10);
      expect(bttsNoWin.outcome).toBe('WIN');
      expect(bttsNoWin.profitUnits).toBe(1.1);
    });

    it('handles voided / cancelled matches safely', () => {
      const voidAh = settleAsianHandicap(0, 0, -0.5, 'home', 1.95, true);
      expect(voidAh.outcome).toBe('VOID');
      expect(voidAh.profitUnits).toBe(0);

      const voidBtts = settleBtts(0, 0, 'yes', 1.80, true);
      expect(voidBtts.outcome).toBe('VOID');
      expect(voidBtts.profitUnits).toBe(0);
    });
  });

  // ==========================================================================
  // TEST G: API-FOOTBALL PRO QUOTA SAFETY & COST REGISTRY
  // ==========================================================================
  describe('Test G: API-Football PRO Quota Safety', () => {
    it('registers all required PRO endpoints in API_COST_REGISTRY', () => {
      const endpoints = API_COST_REGISTRY.filter((e) => e.provider === 'apifootball').map((e) => e.endpoint);

      expect(endpoints).toContain('fixtures');
      expect(endpoints).toContain('fixtures/statistics');
      expect(endpoints).toContain('teams/statistics');
      expect(endpoints).toContain('odds');
      expect(endpoints).toContain('odds/bookmakers');
      expect(endpoints).toContain('odds/bets');
      expect(endpoints).toContain('odds/live');
      expect(endpoints).toContain('standings');
      expect(endpoints).toContain('injuries');
      expect(endpoints).toContain('venues');
      expect(endpoints).toContain('lineups');
    });
  });
});
