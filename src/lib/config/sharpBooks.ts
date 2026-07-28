// EPIC 52 Stage A — Sharp Bookmaker Allowlist
// Config value, NOT hardcoded in query logic.
// Add new books here without touching fetch code (Rule #1 reproducibility).
//
// These are the only bookmakers used for pre-match odds enrichment.
// All others in the OddsPapi response are filtered out client-side.

export interface SharpBookConfig {
  key: string;      // OddsPapi bookmaker key (e.g. 'pinnacle', 'singbet')
  title: string;    // Display name
  enabled: boolean; // false = inactive (for future expansion, not removed)
  note?: string;
}

export const SHARP_BOOKS: SharpBookConfig[] = [
  { key: 'pinnacle',        title: 'Pinnacle',           enabled: true },
  { key: 'singbet',         title: 'Singbet',            enabled: true },
  { key: 'sbobet',          title: 'SBOBet',             enabled: true },
  { key: 'betfair_ex_eu',   title: 'Betfair Exchange',   enabled: true },
  // Future: NBA / Tennis expansion (same OddsPapi account — one-line enable)
  { key: 'circa',           title: 'Circa Sports',       enabled: false, note: 'Flag inactive — enable for NBA/Tennis' },
];

export const ENABLED_SHARP_BOOK_KEYS: string[] = SHARP_BOOKS
  .filter((b) => b.enabled)
  .map((b) => b.key);

export const ODDS_MARKETS = [
  'h2h',           // Moneyline / 1X2
  'spreads',       // Asian Handicap (point-spread equivalent)
  'totals',        // Over/Under
  'btts',          // Both Teams to Score
];
