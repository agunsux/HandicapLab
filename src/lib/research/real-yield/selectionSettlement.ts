/**
 * SELECTION & SETTLEMENT ENGINE
 * Location: src/lib/research/real-yield/selectionSettlement.ts
 *
 * Implements deterministic selection, odds validity checks,
 * and canonical settlement across AH, OU 2.5, and 1X2 markets.
 */

import { settleAsianHandicapBet, AhOutcome, AhSettlementResult } from '../ahSettlementEngine';
import { AuditablePrediction, StrictWalkForwardAdapter } from './walkForwardAdapter';
import { AhSide } from '../model-a/types';

export type BetOutcome = 'WIN' | 'LOSS' | 'PUSH' | 'HALF_WIN' | 'HALF_LOSS';

export interface ExecutableBet {
  betId: string;
  fixtureId: string;
  leagueId: string;
  season: string;
  kickoffDate: string;
  kickoffTimestamp: string;
  predictionTimestamp: string;
  oddsTimestamp: string;
  market: 'AH' | 'OU_2_5' | '1X2';
  outcomeSelection: string; // e.g. 'HOME', 'AWAY', 'OVER', 'UNDER', 'DRAW', line e.g. '-0.25'
  line: number | null;
  side?: AhSide;
  decimalOdds: number;
  modelProbability: number;
  expectedValue: number;
  stake: number; // 1.0 unit
  pnl: number;
  returnAmount: number;
  outcome: BetOutcome;
  trainingCutoffDate: string;
  trainingObservationCount: number;
  lastTrainingMatchDate: string | null;
}

export interface PinnacleMarketOdds {
  canonical_id: string;
  league_id: string;
  season: string;
  match_date: string;
  ah?: {
    line: number;
    home_odds: number;
    away_odds: number;
  };
  ou?: {
    line: number; // 2.5
    over_odds: number;
    under_odds: number;
  };
  ml?: {
    home_odds: number;
    draw_odds: number;
    away_odds: number;
  };
}

export class SelectionSettlementEngine {
  public static readonly MIN_ODDS = 1.20;
  public static readonly MAX_ODDS = 20.00;
  public static readonly PRE_REGISTERED_MIN_EV = 0.02; // 2.0% minimum expected edge

  /**
   * Asserts whether an odds value satisfies the frozen validity rules.
   */
  public static isValidOdds(odds: unknown): odds is number {
    if (typeof odds !== 'number' || Number.isNaN(odds) || !Number.isFinite(odds)) {
      return false;
    }
    return odds >= this.MIN_ODDS && odds <= this.MAX_ODDS;
  }

  /**
   * Deterministic settlement for 1X2 market.
   */
  public static settle1X2(
    actualHomeGoals: number,
    actualAwayGoals: number,
    selection: 'HOME' | 'DRAW' | 'AWAY',
    decimalOdds: number,
    stake = 1.0
  ): { outcome: BetOutcome; pnl: number; returnAmount: number } {
    let won = false;
    if (selection === 'HOME') won = actualHomeGoals > actualAwayGoals;
    else if (selection === 'DRAW') won = actualHomeGoals === actualAwayGoals;
    else if (selection === 'AWAY') won = actualHomeGoals < actualAwayGoals;

    if (won) {
      const pnl = Number((stake * (decimalOdds - 1)).toFixed(4));
      return { outcome: 'WIN', pnl, returnAmount: stake + pnl };
    } else {
      return { outcome: 'LOSS', pnl: -stake, returnAmount: 0 };
    }
  }

  /**
   * Deterministic settlement for Over/Under 2.5 market.
   */
  public static settleOU25(
    actualHomeGoals: number,
    actualAwayGoals: number,
    selection: 'OVER' | 'UNDER',
    decimalOdds: number,
    stake = 1.0
  ): { outcome: BetOutcome; pnl: number; returnAmount: number } {
    const totalGoals = actualHomeGoals + actualAwayGoals;
    let won = false;
    if (selection === 'OVER') won = totalGoals >= 3;
    else if (selection === 'UNDER') won = totalGoals <= 2;

    if (won) {
      const pnl = Number((stake * (decimalOdds - 1)).toFixed(4));
      return { outcome: 'WIN', pnl, returnAmount: stake + pnl };
    } else {
      return { outcome: 'LOSS', pnl: -stake, returnAmount: 0 };
    }
  }

  /**
   * Deterministic settlement for Asian Handicap market via canonical engine.
   */
  public static settleAH(
    actualHomeGoals: number,
    actualAwayGoals: number,
    line: number,
    side: AhSide,
    decimalOdds: number,
    stake = 1.0
  ): { outcome: BetOutcome; pnl: number; returnAmount: number } {
    const res: AhSettlementResult = settleAsianHandicapBet(
      actualHomeGoals,
      actualAwayGoals,
      line,
      decimalOdds,
      side,
      stake
    );

    return {
      outcome: res.outcome,
      pnl: res.profit,
      returnAmount: res.returnAmount,
    };
  }

  /**
   * Selects bets for a single fixture across Tier 1 markets.
   * Maximum 1 bet per fixture per market.
   * Deterministic tie-breaking on highest EV.
   */
  public static selectBetsForFixture(
    prediction: AuditablePrediction,
    odds: PinnacleMarketOdds,
    minEv = this.PRE_REGISTERED_MIN_EV
  ): ExecutableBet[] {
    const bets: ExecutableBet[] = [];
    const oddsTimestamp = `${prediction.kickoffDate}T06:00:00.000Z`; // opening odds timestamp strictly <= kickoff

    // 1. 1X2 Market Selection
    if (odds.ml) {
      const candidates: {
        selection: 'HOME' | 'DRAW' | 'AWAY';
        odds: number;
        prob: number;
        ev: number;
      }[] = [];

      if (this.isValidOdds(odds.ml.home_odds)) {
        const prob = prediction.probabilities.pHomeWin;
        const ev = Number((prob * odds.ml.home_odds - 1).toFixed(4));
        if (ev >= minEv) candidates.push({ selection: 'HOME', odds: odds.ml.home_odds, prob, ev });
      }

      if (this.isValidOdds(odds.ml.draw_odds)) {
        const prob = prediction.probabilities.pDraw;
        const ev = Number((prob * odds.ml.draw_odds - 1).toFixed(4));
        if (ev >= minEv) candidates.push({ selection: 'DRAW', odds: odds.ml.draw_odds, prob, ev });
      }

      if (this.isValidOdds(odds.ml.away_odds)) {
        const prob = prediction.probabilities.pAwayWin;
        const ev = Number((prob * odds.ml.away_odds - 1).toFixed(4));
        if (ev >= minEv) candidates.push({ selection: 'AWAY', odds: odds.ml.away_odds, prob, ev });
      }

      if (candidates.length > 0) {
        // Sort by EV descending. Deterministic tie break: HOME > DRAW > AWAY
        candidates.sort((a, b) => {
          if (Math.abs(b.ev - a.ev) > 1e-5) return b.ev - a.ev;
          const order = { HOME: 1, DRAW: 2, AWAY: 3 };
          return order[a.selection] - order[b.selection];
        });

        const best = candidates[0];
        const settlement = this.settle1X2(
          prediction.actualHomeGoals,
          prediction.actualAwayGoals,
          best.selection,
          best.odds,
          1.0
        );

        bets.push({
          betId: `${prediction.fixtureId}|1X2|${best.selection}`,
          fixtureId: prediction.fixtureId,
          leagueId: prediction.leagueId,
          season: prediction.season,
          kickoffDate: prediction.kickoffDate,
          kickoffTimestamp: prediction.kickoffTimestamp,
          predictionTimestamp: prediction.predictionTimestamp,
          oddsTimestamp,
          market: '1X2',
          outcomeSelection: best.selection,
          line: null,
          decimalOdds: best.odds,
          modelProbability: best.prob,
          expectedValue: best.ev,
          stake: 1.0,
          pnl: settlement.pnl,
          returnAmount: settlement.returnAmount,
          outcome: settlement.outcome,
          trainingCutoffDate: prediction.trainingCutoffDate,
          trainingObservationCount: prediction.trainingObservationCount,
          lastTrainingMatchDate: prediction.lastTrainingMatchDate,
        });
      }
    }

    // 2. OU 2.5 Market Selection
    if (odds.ou && odds.ou.line === 2.5) {
      const candidates: {
        selection: 'OVER' | 'UNDER';
        odds: number;
        prob: number;
        ev: number;
      }[] = [];

      if (this.isValidOdds(odds.ou.over_odds)) {
        const prob = prediction.probabilities.pOver25;
        const ev = Number((prob * odds.ou.over_odds - 1).toFixed(4));
        if (ev >= minEv) candidates.push({ selection: 'OVER', odds: odds.ou.over_odds, prob, ev });
      }

      if (this.isValidOdds(odds.ou.under_odds)) {
        const prob = prediction.probabilities.pUnder25;
        const ev = Number((prob * odds.ou.under_odds - 1).toFixed(4));
        if (ev >= minEv) candidates.push({ selection: 'UNDER', odds: odds.ou.under_odds, prob, ev });
      }

      if (candidates.length > 0) {
        // Sort by EV descending. Deterministic tie break: UNDER > OVER
        candidates.sort((a, b) => {
          if (Math.abs(b.ev - a.ev) > 1e-5) return b.ev - a.ev;
          return a.selection === 'UNDER' ? -1 : 1;
        });

        const best = candidates[0];
        const settlement = this.settleOU25(
          prediction.actualHomeGoals,
          prediction.actualAwayGoals,
          best.selection,
          best.odds,
          1.0
        );

        bets.push({
          betId: `${prediction.fixtureId}|OU_2_5|${best.selection}`,
          fixtureId: prediction.fixtureId,
          leagueId: prediction.leagueId,
          season: prediction.season,
          kickoffDate: prediction.kickoffDate,
          kickoffTimestamp: prediction.kickoffTimestamp,
          predictionTimestamp: prediction.predictionTimestamp,
          oddsTimestamp,
          market: 'OU_2_5',
          outcomeSelection: best.selection,
          line: 2.5,
          decimalOdds: best.odds,
          modelProbability: best.prob,
          expectedValue: best.ev,
          stake: 1.0,
          pnl: settlement.pnl,
          returnAmount: settlement.returnAmount,
          outcome: settlement.outcome,
          trainingCutoffDate: prediction.trainingCutoffDate,
          trainingObservationCount: prediction.trainingObservationCount,
          lastTrainingMatchDate: prediction.lastTrainingMatchDate,
        });
      }
    }

    // 3. AH Market Selection
    if (odds.ah && typeof odds.ah.line === 'number') {
      const candidates: {
        side: AhSide;
        line: number;
        odds: number;
        prob: number;
        ev: number;
      }[] = [];

      // Home side
      if (this.isValidOdds(odds.ah.home_odds)) {
        const hProb = StrictWalkForwardAdapter.computeAhProbabilities(
          prediction,
          odds.ah.line,
          odds.ah.home_odds,
          'HOME'
        );
        if (hProb.ev >= minEv) {
          candidates.push({
            side: 'HOME',
            line: odds.ah.line,
            odds: odds.ah.home_odds,
            prob: hProb.pCover,
            ev: hProb.ev,
          });
        }
      }

      // Away side
      if (this.isValidOdds(odds.ah.away_odds)) {
        const aProb = StrictWalkForwardAdapter.computeAhProbabilities(
          prediction,
          -odds.ah.line,
          odds.ah.away_odds,
          'AWAY'
        );
        if (aProb.ev >= minEv) {
          candidates.push({
            side: 'AWAY',
            line: -odds.ah.line,
            odds: odds.ah.away_odds,
            prob: aProb.pCover,
            ev: aProb.ev,
          });
        }
      }

      if (candidates.length > 0) {
        // Sort by EV descending. Deterministic tie break: HOME > AWAY
        candidates.sort((a, b) => {
          if (Math.abs(b.ev - a.ev) > 1e-5) return b.ev - a.ev;
          return a.side === 'HOME' ? -1 : 1;
        });

        const best = candidates[0];
        const settlement = this.settleAH(
          prediction.actualHomeGoals,
          prediction.actualAwayGoals,
          best.line,
          best.side,
          best.odds,
          1.0
        );

        bets.push({
          betId: `${prediction.fixtureId}|AH|${best.side}|${best.line}`,
          fixtureId: prediction.fixtureId,
          leagueId: prediction.leagueId,
          season: prediction.season,
          kickoffDate: prediction.kickoffDate,
          kickoffTimestamp: prediction.kickoffTimestamp,
          predictionTimestamp: prediction.predictionTimestamp,
          oddsTimestamp,
          market: 'AH',
          outcomeSelection: `${best.side}|${best.line}`,
          line: best.line,
          side: best.side,
          decimalOdds: best.odds,
          modelProbability: best.prob,
          expectedValue: best.ev,
          stake: 1.0,
          pnl: settlement.pnl,
          returnAmount: settlement.returnAmount,
          outcome: settlement.outcome,
          trainingCutoffDate: prediction.trainingCutoffDate,
          trainingObservationCount: prediction.trainingObservationCount,
          lastTrainingMatchDate: prediction.lastTrainingMatchDate,
        });
      }
    }

    return bets;
  }
}

