/**
 * HandicapLab Market Settlement Engine
 * =====================================
 * Generic settlement that works with ANY registered market.
 *
 * Usage:
 *   const engine = new MarketSettlementEngine();
 *   const result = engine.settle('ML', 2, 1, 'home');
 *   // => 'won'
 */

import { marketRegistry } from './registry';
import { SettlementInput, SettlementResult } from './types';

export class MarketSettlementEngine {
  settle(marketType: string, homeGoals: number, awayGoals: number, selection: string, line?: number): SettlementResult {
    return marketRegistry.getTranslator(marketType).settle({ marketType, selection, line, homeGoals, awayGoals });
  }

  static settleAll(outcomes: Array<{ marketType: string; homeGoals: number; awayGoals: number; selection: string; line?: number }>): SettlementResult[] {
    const engine = new MarketSettlementEngine();
    return outcomes.map((o) => engine.settle(o.marketType, o.homeGoals, o.awayGoals, o.selection, o.line));
  }
}