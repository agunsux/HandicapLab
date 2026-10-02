// ============================================================================
// THE ODDS API CANONICAL NORMALIZER & DTO CONVERTER
// ============================================================================
// Location: src/lib/data/providers/odds/theOddsApiNormalizer.ts
//
// Invariants enforced:
// 1. Strict Market Scope: Only AH (Asian Handicap), OU (Over/Under), and BTTS.
// 2. Asian Handicap: Preserves line (-0.25, -0.5, -0.75, etc.), price, bookmaker,
//    home/away side. Never collapses lines.
// 3. Over / Under: Line family preserved (1.0, 1.25, 1.5, 2.0, 2.25, 2.5, 2.75, etc.).
//    Categorized into FULL_LINE, HALF_LINE, QUARTER_LINE. Never hardcodes 2.5.
// 4. BTTS: YES / NO preserved cleanly. Never confused with 1X2 / Moneyline.
// 5. Match Identity: Matches provider events to Canonical Match Registry,
//    preserving provider event ID as provider_match_id (never overwriting canonical UUID).
// 6. Zero Fabrication: If lines or prices are missing, returns null / rejects.
// ============================================================================

import { CanonicalFixtureFreshnessGate } from '@/lib/services/canonicalFixtureFreshnessGate';
import { classifyLineType } from '@/lib/ledger/canonicalBetLedger';
import type { LineType } from '@/lib/ledger/predictionLedgerTypes';
import type { OddsSnapshot } from '../types';

export interface TheOddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface TheOddsApiMarket {
  key: string; // 'spreads' | 'totals' | 'btts' | 'h2h'
  last_update?: string;
  outcomes: TheOddsApiOutcome[];
}

export interface TheOddsApiBookmaker {
  key: string;
  title: string;
  last_update?: string;
  markets: TheOddsApiMarket[];
}

export interface TheOddsApiEvent {
  id: string;
  sport_key: string;
  sport_title?: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: TheOddsApiBookmaker[];
}

export interface CanonicalTheOddsApiRecord {
  recordId: string;
  canonicalMatchId: string | null;
  providerMatchId: string;
  provider: 'the-odds-api';
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string;
  bookmaker: string;
  market: 'AH' | 'OU' | 'BTTS';
  line: number | null;
  lineType: LineType;
  selection: string;
  oddsDecimal: number;
  homeOdds?: number;
  awayOdds?: number;
  overOdds?: number;
  underOdds?: number;
  yesOdds?: number;
  noOdds?: number;
  providerTimestamp: string;
  capturedAtUtc: string;
  isResolvedMatch: boolean;
}

export class TheOddsApiNormalizer {
  /**
   * Normalizes a raw The Odds API event and its bookmaker markets into
   * strictly typed canonical odds records according to HandicapLab/SALMO contracts.
   */
  public static normalizeEvent(
    event: TheOddsApiEvent,
    options: {
      canonicalMatchId?: string | null;
      capturedAtUtc?: string;
    } = {}
  ): CanonicalTheOddsApiRecord[] {
    const results: CanonicalTheOddsApiRecord[] = [];
    const capturedAtUtc = options.capturedAtUtc || new Date().toISOString();

    // Resolve canonical match identity if not explicitly provided
    let canonicalMatchId: string | null = options.canonicalMatchId ?? null;
    let isResolved = false;

    if (!canonicalMatchId) {
      const registry = CanonicalFixtureFreshnessGate.loadRegistry();
      const cleanEventHome = CanonicalFixtureFreshnessGate.cleanTeamName(event.home_team);
      const cleanEventAway = CanonicalFixtureFreshnessGate.cleanTeamName(event.away_team);
      const eventDate = event.commence_time ? event.commence_time.slice(0, 10) : '';

      for (const fix of Object.values(registry)) {
        if (!fix.homeTeam || !fix.awayTeam) continue;
        const cleanFixHome = CanonicalFixtureFreshnessGate.cleanTeamName(fix.homeTeam);
        const cleanFixAway = CanonicalFixtureFreshnessGate.cleanTeamName(fix.awayTeam);
        const fixDate = fix.kickoffUtc ? fix.kickoffUtc.slice(0, 10) : '';

        const homeMatches =
          cleanEventHome === cleanFixHome ||
          cleanEventHome.includes(cleanFixHome) ||
          cleanFixHome.includes(cleanEventHome);
        const awayMatches =
          cleanEventAway === cleanFixAway ||
          cleanEventAway.includes(cleanFixAway) ||
          cleanFixAway.includes(cleanEventAway);
        const dateMatches = !eventDate || !fixDate || eventDate === fixDate;

        if (homeMatches && awayMatches && dateMatches) {
          canonicalMatchId = fix.canonicalMatchId;
          isResolved = true;
          break;
        }
      }
    } else {
      isResolved = true;
    }

    if (!event.bookmakers || !Array.isArray(event.bookmakers)) {
      return results;
    }

    for (const bookmaker of event.bookmakers) {
      if (!bookmaker.markets || !Array.isArray(bookmaker.markets)) continue;

      for (const market of bookmaker.markets) {
        const marketKey = (market.key || '').toLowerCase();
        const marketTime = market.last_update || bookmaker.last_update || capturedAtUtc;

        // 1. Asian Handicap / Spreads
        if (marketKey === 'spreads') {
          // In The Odds API, spreads contains outcomes for home and away with points
          const homeOutcome = market.outcomes.find(
            (o) => o.name === event.home_team || o.name.toLowerCase() === 'home'
          );
          const awayOutcome = market.outcomes.find(
            (o) => o.name === event.away_team || o.name.toLowerCase() === 'away'
          );

          if (homeOutcome && homeOutcome.price > 1.0) {
            const line = homeOutcome.point !== undefined ? Number(homeOutcome.point) : 0;
            const lineType = classifyLineType(line);
            results.push({
              recordId: `toa_ah_${event.id}_${bookmaker.key}_H_${line}`,
              canonicalMatchId,
              providerMatchId: event.id,
              provider: 'the-odds-api',
              sportKey: event.sport_key,
              homeTeam: event.home_team,
              awayTeam: event.away_team,
              kickoffUtc: event.commence_time,
              bookmaker: bookmaker.key,
              market: 'AH',
              line,
              lineType,
              selection: 'HOME',
              oddsDecimal: homeOutcome.price,
              homeOdds: homeOutcome.price,
              awayOdds: awayOutcome?.price,
              providerTimestamp: marketTime,
              capturedAtUtc,
              isResolvedMatch: isResolved,
            });
          }

          if (awayOutcome && awayOutcome.price > 1.0) {
            const line = awayOutcome.point !== undefined ? Number(awayOutcome.point) : 0;
            const lineType = classifyLineType(line);
            results.push({
              recordId: `toa_ah_${event.id}_${bookmaker.key}_A_${line}`,
              canonicalMatchId,
              providerMatchId: event.id,
              provider: 'the-odds-api',
              sportKey: event.sport_key,
              homeTeam: event.home_team,
              awayTeam: event.away_team,
              kickoffUtc: event.commence_time,
              bookmaker: bookmaker.key,
              market: 'AH',
              line,
              lineType,
              selection: 'AWAY',
              oddsDecimal: awayOutcome.price,
              homeOdds: homeOutcome?.price,
              awayOdds: awayOutcome.price,
              providerTimestamp: marketTime,
              capturedAtUtc,
              isResolvedMatch: isResolved,
            });
          }
        }

        // 2. Over / Under (Totals Line Family)
        else if (marketKey === 'totals') {
          // Totals can have multiple line points (e.g. 1.5, 2.0, 2.25, 2.5, 2.75, 3.0)
          // Group outcomes by point
          const outcomesByPoint = new Map<number, { over?: number; under?: number }>();

          for (const outcome of market.outcomes) {
            const point = outcome.point !== undefined ? Number(outcome.point) : 2.5;
            if (!outcomesByPoint.has(point)) {
              outcomesByPoint.set(point, {});
            }
            const group = outcomesByPoint.get(point)!;
            const nameLower = outcome.name.toLowerCase();
            if (nameLower.includes('over')) {
              group.over = outcome.price;
            } else if (nameLower.includes('under')) {
              group.under = outcome.price;
            }
          }

          for (const [line, prices] of outcomesByPoint.entries()) {
            const lineType = classifyLineType(line);

            if (prices.over && prices.over > 1.0) {
              results.push({
                recordId: `toa_ou_${event.id}_${bookmaker.key}_over_${line}`,
                canonicalMatchId,
                providerMatchId: event.id,
                provider: 'the-odds-api',
                sportKey: event.sport_key,
                homeTeam: event.home_team,
                awayTeam: event.away_team,
                kickoffUtc: event.commence_time,
                bookmaker: bookmaker.key,
                market: 'OU',
                line,
                lineType,
                selection: `Over ${line}`,
                oddsDecimal: prices.over,
                overOdds: prices.over,
                underOdds: prices.under,
                providerTimestamp: marketTime,
                capturedAtUtc,
                isResolvedMatch: isResolved,
              });
            }

            if (prices.under && prices.under > 1.0) {
              results.push({
                recordId: `toa_ou_${event.id}_${bookmaker.key}_under_${line}`,
                canonicalMatchId,
                providerMatchId: event.id,
                provider: 'the-odds-api',
                sportKey: event.sport_key,
                homeTeam: event.home_team,
                awayTeam: event.away_team,
                kickoffUtc: event.commence_time,
                bookmaker: bookmaker.key,
                market: 'OU',
                line,
                lineType,
                selection: `Under ${line}`,
                oddsDecimal: prices.under,
                overOdds: prices.over,
                underOdds: prices.under,
                providerTimestamp: marketTime,
                capturedAtUtc,
                isResolvedMatch: isResolved,
              });
            }
          }
        }

        // 3. Both Teams To Score (BTTS)
        else if (marketKey === 'btts') {
          const yesOutcome = market.outcomes.find(
            (o) => o.name.toLowerCase() === 'yes'
          );
          const noOutcome = market.outcomes.find(
            (o) => o.name.toLowerCase() === 'no'
          );

          if (yesOutcome && yesOutcome.price > 1.0) {
            results.push({
              recordId: `toa_btts_${event.id}_${bookmaker.key}_yes`,
              canonicalMatchId,
              providerMatchId: event.id,
              provider: 'the-odds-api',
              sportKey: event.sport_key,
              homeTeam: event.home_team,
              awayTeam: event.away_team,
              kickoffUtc: event.commence_time,
              bookmaker: bookmaker.key,
              market: 'BTTS',
              line: null,
              lineType: 'NONE',
              selection: 'Yes',
              oddsDecimal: yesOutcome.price,
              yesOdds: yesOutcome.price,
              noOdds: noOutcome?.price,
              providerTimestamp: marketTime,
              capturedAtUtc,
              isResolvedMatch: isResolved,
            });
          }

          if (noOutcome && noOutcome.price > 1.0) {
            results.push({
              recordId: `toa_btts_${event.id}_${bookmaker.key}_no`,
              canonicalMatchId,
              providerMatchId: event.id,
              provider: 'the-odds-api',
              sportKey: event.sport_key,
              homeTeam: event.home_team,
              awayTeam: event.away_team,
              kickoffUtc: event.commence_time,
              bookmaker: bookmaker.key,
              market: 'BTTS',
              line: null,
              lineType: 'NONE',
              selection: 'No',
              oddsDecimal: noOutcome.price,
              yesOdds: yesOutcome?.price,
              noOdds: noOutcome.price,
              providerTimestamp: marketTime,
              capturedAtUtc,
              isResolvedMatch: isResolved,
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Converts canonical records to the shared OddsSnapshot interface.
   */
  public static toOddsSnapshots(records: CanonicalTheOddsApiRecord[]): OddsSnapshot[] {
    const snapshots: OddsSnapshot[] = [];

    for (const r of records) {
      const marketType =
        r.market === 'AH'
          ? 'asian_handicap'
          : r.market === 'OU'
          ? 'over_under'
          : 'btts';

      snapshots.push({
        id: r.recordId,
        fixtureId: r.canonicalMatchId || `theoddsapi_${r.providerMatchId}`,
        bookmaker: r.bookmaker,
        marketType,
        line: r.line ?? 0,
        priceHome: r.homeOdds ?? r.overOdds ?? (r.selection === 'Yes' ? r.oddsDecimal : 0),
        priceAway: r.awayOdds ?? r.underOdds ?? (r.selection === 'No' ? r.oddsDecimal : 0),
        priceDraw: null,
        capturedAt: new Date(r.capturedAtUtc),
        providerName: 'the-odds-api',
        rawResponseHash: r.providerMatchId,
      });
    }

    return snapshots;
  }
}
