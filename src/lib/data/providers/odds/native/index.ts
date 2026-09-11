// Native OddsPAPI v4 Adapter — barrel export
// Location: src/lib/data/providers/odds/native/index.ts

export { OddsPapiV4Provider, oddsPapiV4Provider } from './provider';
export type { OddsProviderStatus, OddsProviderStatusDetail } from './provider';
export { OddsPapiDiscovery, oddsPapiDiscovery } from './discovery';
export { createNativeOddsClient, OddsPapiError } from './client';
export type { NativeOddsClient } from './client';
export {
  normalizeNativeOddsResponse,
  normalizeNativeFixture,
  normalizeHistoricalOdds,
  selectEntryAndClosing,
} from './normalize';
export type {
  NormalizedSharpFixture,
  NormalizationStats,
  HistoricalOddPoint,
  EntryClosingSelection,
} from './normalize';
export {
  NativeOddsResponseSchema,
  NativeSportsResponseSchema,
  NativeTournamentsResponseSchema,
  NativeBookmakersResponseSchema,
  NativeMarketsResponseSchema,
  NativeFixturesResponseSchema,
  NativeHistoricalOddsResponseSchema,
} from './schemas';
export type {
  NativeSport,
  NativeTournament,
  NativeBookmaker,
  NativeMarket,
  NativeOddsFixture,
  NativeHistoricalOddsResponse,
} from './schemas';
