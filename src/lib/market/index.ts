/**
 * HandicapLab Market Framework
 * =============================
 * Plugin-based market translation system.
 *
 * ProbabilityEngine produces a goal distribution.
 * Each MarketTranslator converts that into market-specific probabilities.
 *
 * Adding a new market = 1 new translator class. No engine changes.
 *
 * Built-in markets: ML, AH, OU, BTTS
 * Ready for: Correct Score, Double Chance, Draw No Bet, HT/FT, Asian Total
 */

export { MarketRegistry, marketRegistry } from './registry';
export type { MarketTranslator } from './registry';

export { MarketSettlementEngine } from './settlement';

export {
  MoneylineTranslator,
  AsianHandicapTranslator,
  OverUnderTranslator,
  BttsTranslator,
  registerDefaultMarkets,
} from './translators';

export type {
  GoalDistribution,
  MarketTranslationInput,
  MarketTranslationOutput,
  SettlementInput,
  SettlementResult,
  MarketDefinition,
  MarketMetadata,
} from './types';