/**
 * HandicapLab Market Registry
 * =============================
 * Central registry for all market translators.
 *
 * Adding a new market:
 *   1. Create a class implementing MarketTranslator
 *   2. Call marketRegistry.register(new MyMarketTranslator())
 *   3. Done — no engine changes needed
 */

import { MarketDefinition, MarketTranslationInput, MarketTranslationOutput, SettlementInput, SettlementResult } from './types';

export interface MarketTranslator {
  readonly marketType: string;
  readonly definition: MarketDefinition;
  translate(input: MarketTranslationInput): MarketTranslationOutput;
  settle(input: SettlementInput): SettlementResult;
}

export class MarketRegistry {
  private translators: Map<string, MarketTranslator> = new Map();

  register(translator: MarketTranslator): void {
    if (this.translators.has(translator.marketType)) {
      throw new Error(`Market ${translator.marketType} already registered`);
    }
    this.translators.set(translator.marketType, translator);
  }

  getTranslator(marketType: string): MarketTranslator {
    const t = this.translators.get(marketType);
    if (!t) throw new Error(`No translator for market type: ${marketType}`);
    return t;
  }

  translate(marketType: string, input: MarketTranslationInput): MarketTranslationOutput {
    return this.getTranslator(marketType).translate(input);
  }

  settle(marketType: string, input: SettlementInput): SettlementResult {
    return this.getTranslator(marketType).settle(input);
  }

  getAllMarkets(): MarketDefinition[] {
    return Array.from(this.translators.values()).map((t) => t.definition);
  }

  hasMarket(marketType: string): boolean {
    return this.translators.has(marketType);
  }
}

export const marketRegistry = new MarketRegistry();