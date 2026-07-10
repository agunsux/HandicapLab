/**
 * HandicapLab Market Translators
 * ================================
 * Built-in market translators: ML, AH, OU, BTTS.
 *
 * Each translator reads ONLY the score matrix from ProbabilityEngine.
 * No custom prediction logic — purely mechanical translation.
 *
 * To add a new market (e.g. Correct Score):
 *   class CorrectScoreTranslator implements MarketTranslator { ... }
 *   marketRegistry.register(new CorrectScoreTranslator());
 */

import { MarketTranslationInput, MarketTranslationOutput, SettlementInput, SettlementResult, MarketDefinition } from './types';
import { marketRegistry, MarketTranslator } from './registry';

// ─── Moneyline (1X2) ────────────────────────────────────────────────────

export class MoneylineTranslator implements MarketTranslator {
  readonly marketType = 'ML';
  readonly definition: MarketDefinition = {
    id: 'market:ml', name: 'Moneyline', description: '1X2 / Home-Draw-Away',
    hasDraw: true, supportsLine: false,
    settlementRules: 'Home wins if homeGoals > awayGoals. Draw if equal. Away wins if awayGoals > homeGoals.',
  };

  translate(input: MarketTranslationInput): MarketTranslationOutput {
    const sm = input.goalDistribution.scoreMatrix;
    let pHome = 0, pDraw = 0, pAway = 0;
    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        const p = sm[h][a];
        if (h > a) pHome += p;
        else if (h === a) pDraw += p;
        else pAway += p;
      }
    }
    const sum = pHome + pDraw + pAway;
    return {
      marketType: 'ML',
      homeProbability: sum > 0 ? pHome / sum : 0,
      drawProbability: sum > 0 ? pDraw / sum : 0,
      awayProbability: sum > 0 ? pAway / sum : 0,
      fairOdds: {
        home: pHome > 0 ? 1 / (pHome / sum) : 0,
        draw: pDraw > 0 ? 1 / (pDraw / sum) : 0,
        away: pAway > 0 ? 1 / (pAway / sum) : 0,
      },
    };
  }

  settle(input: SettlementInput): SettlementResult {
    const homeWon = input.homeGoals > input.awayGoals;
    const draw = input.homeGoals === input.awayGoals;
    if (input.selection === 'home') return homeWon ? 'won' : (draw ? 'void' : 'lost');
    if (input.selection === 'away') return !homeWon && !draw ? 'won' : (draw ? 'void' : 'lost');
    return draw ? 'won' : 'lost';
  }
}

// ─── Asian Handicap ─────────────────────────────────────────────────────

export class AsianHandicapTranslator implements MarketTranslator {
  readonly marketType = 'AH';
  readonly definition: MarketDefinition = {
    id: 'market:ah', name: 'Asian Handicap', description: 'Handicap betting with push at integer lines',
    hasDraw: false, supportsLine: true,
    settlementRules: 'Home wins if (homeGoals - awayGoals + line) > 0. Void if equal 0. Away wins if < 0.',
  };

  translate(input: MarketTranslationInput): MarketTranslationOutput {
    const line = input.line ?? -0.5;
    const sm = input.goalDistribution.scoreMatrix;
    let homeWin = 0, awayWin = 0;
    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        const p = sm[h][a];
        const margin = h - a + line;
        if (margin > 0) homeWin += p;
        else if (margin < 0) awayWin += p;
      }
    }
    const total = homeWin + awayWin;
    return {
      marketType: 'AH',
      homeProbability: total > 0 ? homeWin / total : 0,
      drawProbability: null,
      awayProbability: total > 0 ? awayWin / total : 0,
      fairOdds: {
        home: homeWin > 0 ? total / homeWin : 0,
        draw: null,
        away: awayWin > 0 ? total / awayWin : 0,
      },
      metadata: { line },
    };
  }

  settle(input: SettlementInput): SettlementResult {
    const margin = input.homeGoals - input.awayGoals + (input.line ?? -0.5);
    if (input.selection === 'home') return margin > 0 ? 'won' : (margin < 0 ? 'lost' : 'void');
    return margin < 0 ? 'won' : (margin > 0 ? 'lost' : 'void');
  }
}

// ─── Over/Under ─────────────────────────────────────────────────────────

export class OverUnderTranslator implements MarketTranslator {
  readonly marketType = 'OU';
  readonly definition: MarketDefinition = {
    id: 'market:ou', name: 'Over/Under', description: 'Total goals over or under a line',
    hasDraw: false, supportsLine: true,
    settlementRules: 'Over wins if total goals > line. Under wins if total goals < line. Void if equal.',
  };

  translate(input: MarketTranslationInput): MarketTranslationOutput {
    const line = input.line ?? 2.5;
    const sm = input.goalDistribution.scoreMatrix;
    let over = 0, under = 0;
    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        const p = sm[h][a];
        if (h + a > line) over += p;
        else under += p;
      }
    }
    const total = over + under;
    return {
      marketType: 'OU',
      homeProbability: total > 0 ? over / total : 0,
      drawProbability: null,
      awayProbability: total > 0 ? under / total : 0,
      fairOdds: {
        home: over > 0 ? total / over : 0,
        draw: null,
        away: under > 0 ? total / under : 0,
      },
      metadata: { line },
    };
  }

  settle(input: SettlementInput): SettlementResult {
    const total = input.homeGoals + input.awayGoals;
    const line = input.line ?? 2.5;
    if (input.selection === 'over') return total > line ? 'won' : (total < line ? 'lost' : 'void');
    return total < line ? 'won' : (total > line ? 'lost' : 'void');
  }
}

// ─── Both Teams to Score (BTTS) ─────────────────────────────────────────

export class BttsTranslator implements MarketTranslator {
  readonly marketType = 'BTTS';
  readonly definition: MarketDefinition = {
    id: 'market:btts', name: 'Both Teams to Score', description: 'Yes if both teams score 1+ goals',
    hasDraw: false, supportsLine: false,
    settlementRules: 'Yes wins if homeGoals >= 1 AND awayGoals >= 1. No wins if either scores 0.',
  };

  translate(input: MarketTranslationInput): MarketTranslationOutput {
    const sm = input.goalDistribution.scoreMatrix;
    let yesProb = 0, noProb = 0;
    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        const p = sm[h][a];
        if (h >= 1 && a >= 1) yesProb += p;
        else noProb += p;
      }
    }
    const total = yesProb + noProb;
    return {
      marketType: 'BTTS',
      homeProbability: total > 0 ? yesProb / total : 0,
      drawProbability: null,
      awayProbability: total > 0 ? noProb / total : 0,
      fairOdds: {
        home: yesProb > 0 ? total / yesProb : 0,
        draw: null,
        away: noProb > 0 ? total / noProb : 0,
      },
    };
  }

  settle(input: SettlementInput): SettlementResult {
    const bothScored = input.homeGoals >= 1 && input.awayGoals >= 1;
    if (input.selection === 'yes') return bothScored ? 'won' : 'lost';
    return bothScored ? 'lost' : 'won';
  }
}

// ─── Auto-register all built-in translators ──────────────────────────────

export function registerDefaultMarkets(): void {
  marketRegistry.register(new MoneylineTranslator());
  marketRegistry.register(new AsianHandicapTranslator());
  marketRegistry.register(new OverUnderTranslator());
  marketRegistry.register(new BttsTranslator());
}