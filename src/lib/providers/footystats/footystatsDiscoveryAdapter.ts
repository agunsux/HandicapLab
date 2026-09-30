// ============================================================================
// FOOTYSTATS RESEARCH & DATA VALIDATION ADAPTER
// ============================================================================
// Location: src/lib/providers/footystats/footystatsDiscoveryAdapter.ts
//
// Invariants enforced:
// 1. Research-first: Strictly independent evidence provider, NOT in production path.
// 2. Zero fabrication: If a field is absent, classify as NOT_AVAILABLE.
// 3. Asian Handicap: FootyStats API does NOT provide bookmaker AH lines;
//    FOOTYSTATS_AH_ODDS is strictly NOT_AVAILABLE.
// 4. Over/Under: Map half-lines (0.5, 1.5, 2.5, 3.5, 4.5); full/quarter lines = NOT_AVAILABLE.
// 5. BTTS: Distinguish betting odds from statistical potential features.
// 6. Odds Provenance: If bookmaker or timestamp is missing, store null and fail-closed
//    (prohibited from Closing Line Value calculation).
// ============================================================================

import crypto from 'crypto';
import { classifyLineType } from '@/lib/ledger/canonicalBetLedger';
import type { LineType } from '@/lib/ledger/predictionLedgerTypes';

export type FieldAvailability =
  | 'AVAILABLE'
  | 'NOT_AVAILABLE'
  | 'UNKNOWN'
  | 'REQUIRES_PAID_PLAN';

export interface FieldDocumentation {
  field: string;
  category: 'FIXTURE_IDENTITY' | 'FOOTBALL_INTELLIGENCE' | 'BETTING_DATA';
  status: FieldAvailability;
  endpoint: string;
  rawFieldName: string;
  dataType: string;
  notes: string;
}

export interface FootyStatsOddsRecord {
  provider: 'FOOTYSTATS';
  providerMatchId: number | string;
  canonicalMatchId?: string;
  bookmaker: null;
  oddsProvenanceStatus: 'INCOMPLETE';
  market: 'OU' | 'BTTS';
  selection: 'OVER' | 'UNDER' | 'YES' | 'NO';
  line: number | null;
  lineType: LineType;
  price: number;
  capturedAtUtc: string;
  rawSourceTimestampUtc: null;
  oddsTimestampUtc: null;
  oddsFreshnessStatus: 'UNKNOWN';
  clvUsable: false;
  sourceEndpoint: string;
  rawRecordHash: string;
}

export class FootyStatsDiscoveryAdapter {
  public static readonly PROVIDER_NAME = 'FOOTYSTATS';
  public static readonly STATUS = 'RESEARCH_ONLY';
  public static readonly FOOTYSTATS_AH_ODDS: FieldAvailability = 'NOT_AVAILABLE';

  /**
   * Complete inventory and classification of FootyStats API schema fields.
   */
  public static getFieldSchemaDocumentation(): FieldDocumentation[] {
    return [
      // A. Fixture Identity
      {
        field: 'providerMatchId',
        category: 'FIXTURE_IDENTITY',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'id',
        dataType: 'Integer',
        notes: 'Unique FootyStats match integer identifier (e.g. 7466677).',
      },
      {
        field: 'competition',
        category: 'FIXTURE_IDENTITY',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'competition_id',
        dataType: 'Integer / String',
        notes: 'FootyStats competition code / competition_name.',
      },
      {
        field: 'season',
        category: 'FIXTURE_IDENTITY',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'season',
        dataType: 'String',
        notes: 'Season formatted as "2024/2025" or "2024-2025".',
      },
      {
        field: 'homeTeam',
        category: 'FIXTURE_IDENTITY',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'home_name',
        dataType: 'String',
        notes: 'Human-readable home team name; requires entity normalization.',
      },
      {
        field: 'awayTeam',
        category: 'FIXTURE_IDENTITY',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'away_name',
        dataType: 'String',
        notes: 'Human-readable away team name; requires entity normalization.',
      },
      {
        field: 'kickoffTimestamp',
        category: 'FIXTURE_IDENTITY',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'date_unix',
        dataType: 'Integer (Unix UTC)',
        notes: 'Kickoff timestamp in seconds; point-in-time anchor.',
      },
      {
        field: 'fixtureStatus',
        category: 'FIXTURE_IDENTITY',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'status',
        dataType: 'String',
        notes: 'Lifecycle state: "complete", "incomplete", "suspended".',
      },

      // B. Football Intelligence
      {
        field: 'homeAwayPPG',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'home_ppg / away_ppg',
        dataType: 'Float',
        notes: 'Season aggregate PPG; WARNING: introduces temporal leakage if used pre-match.',
      },
      {
        field: 'preMatchPPG',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'pre_match_home_ppg / pre_match_away_ppg',
        dataType: 'Float',
        notes: 'Rolling PPG strictly prior to match kickoff; point-in-time safe.',
      },
      {
        field: 'goalsScoredConceded',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'homeGoalCount / awayGoalCount',
        dataType: 'Integer',
        notes: 'Full-time actual goals; post-match ground truth only.',
      },
      {
        field: 'expectedGoals_postMatch',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'team_a_xg / team_b_xg / total_xg',
        dataType: 'Float',
        notes: 'FootyStats proprietary post-match xG.',
      },
      {
        field: 'expectedGoals_preMatch',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'team_a_xg_prematch / team_b_xg_prematch',
        dataType: 'Float',
        notes: 'FootyStats pre-match projected xG expectation; point-in-time safe.',
      },
      {
        field: 'bttsPercentagePotential',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'btts_potential',
        dataType: 'Integer (0-100)',
        notes: 'Pre-match BTTS rate projection; black-box mathematical rate.',
      },
      {
        field: 'overUnderPercentagePotential',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'o05_potential to o45_potential / u05_potential to u45_potential',
        dataType: 'Integer (0-100)',
        notes: 'Pre-match O/U probability projections across half lines.',
      },
      {
        field: 'averageGoalsPotential',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'avg_potential',
        dataType: 'Float',
        notes: 'Pre-match expected total goals.',
      },
      {
        field: 'attackMetrics',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'team_a_attacks / team_a_dangerous_attacks',
        dataType: 'Integer',
        notes: 'Post-match attack and dangerous attack totals.',
      },
      {
        field: 'defenceDisciplineMetrics',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'team_a_fouls / team_a_yellow_cards / team_a_red_cards',
        dataType: 'Integer',
        notes: 'Post-match defensive and disciplinary tallies.',
      },
      {
        field: 'recentForm',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/match & /league-teams',
        rawFieldName: 'team_a_form / team_b_form',
        dataType: 'String / Integer',
        notes: 'Available on single-match or team endpoints; derived from schedule in bulk.',
      },
      {
        field: 'headToHead',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/match',
        rawFieldName: 'h2h',
        dataType: 'Object / Array',
        notes: 'Available on individual /match endpoint; not embedded in bulk /league-matches.',
      },
      {
        field: 'cleanSheetStats',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'odds_team_a_cs_yes / derived',
        dataType: 'Float / Computed',
        notes: 'Clean sheet odds embedded; statistical frequency derived from past fixtures.',
      },
      {
        field: 'failedToScoreStats',
        category: 'FOOTBALL_INTELLIGENCE',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'derived from homeGoalCount / awayGoalCount == 0',
        dataType: 'Computed',
        notes: 'Computed point-in-time from rolling historical results.',
      },

      // C. Betting Data — Asian Handicap (AH)
      {
        field: 'ah_handicapLine',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches & /match',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'FootyStats does not publish bookmaker Asian Handicap lines in API match schema.',
      },
      {
        field: 'ah_homeAwaySelection',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches & /match',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'No home/away Asian Handicap selection structure exists.',
      },
      {
        field: 'ah_priceOdds',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches & /match',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'Asian Handicap odds are completely absent from FootyStats API payloads.',
      },
      {
        field: 'ah_bookmakerIdentity',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches & /match',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'No Asian Handicap bookmaker declared.',
      },
      {
        field: 'ah_timestamp',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches & /match',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'No odds capture or closing timestamp provided.',
      },
      {
        field: 'ah_openingClosingOdds',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches & /match',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'No opening or closing line distinction.',
      },

      // C. Betting Data — Over / Under (OU)
      {
        field: 'ou_halfLines_05_to_45',
        category: 'BETTING_DATA',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'odds_ft_over05 to over45 / under05 to under45',
        dataType: 'Float',
        notes: 'Available for lines 0.5, 1.5, 2.5, 3.5, 4.5. All are HALF_LINE.',
      },
      {
        field: 'ou_fullLines_10_20_30_40',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'Full lines (1.0, 2.0, 3.0, 4.0) do NOT exist in FootyStats API.',
      },
      {
        field: 'ou_quarterLines',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'Quarter lines (0.75, 1.25, 1.75, 2.25, etc.) do NOT exist in FootyStats API.',
      },
      {
        field: 'ou_bookmakerIdentity',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'Bookmaker supplying O/U odds is NOT stated (stored as null).',
      },
      {
        field: 'ou_timestamp',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'Timestamp of odds capture is unrecorded (stored as null).',
      },
      {
        field: 'ou_openingClosingOdds',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'No opening or closing line distinction.',
      },

      // C. Betting Data — Both Teams To Score (BTTS)
      {
        field: 'btts_yesPrice',
        category: 'BETTING_DATA',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'odds_btts_yes',
        dataType: 'Float',
        notes: 'Decimal odds for Both Teams To Score = YES.',
      },
      {
        field: 'btts_noPrice',
        category: 'BETTING_DATA',
        status: 'AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'odds_btts_no',
        dataType: 'Float',
        notes: 'Decimal odds for Both Teams To Score = NO.',
      },
      {
        field: 'btts_bookmakerIdentity',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'Bookmaker for BTTS odds is NOT stated (stored as null).',
      },
      {
        field: 'btts_timestamp',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'Timestamp of BTTS odds capture is unrecorded (stored as null).',
      },
      {
        field: 'btts_openingClosingOdds',
        category: 'BETTING_DATA',
        status: 'NOT_AVAILABLE',
        endpoint: '/league-matches',
        rawFieldName: 'N/A',
        dataType: 'N/A',
        notes: 'No opening or closing line distinction.',
      },
    ];
  }

  /**
   * Normalizes raw FootyStats match odds into standard HandicapLab research records.
   * Enforces zero fabrication of bookmaker and timestamps.
   */
  public static extractOddsRecords(rawMatch: any): FootyStatsOddsRecord[] {
    const records: FootyStatsOddsRecord[] = [];
    const matchId = rawMatch.id;
    const capturedAtUtc = new Date().toISOString();
    const endpoint = '/league-matches';

    const computeHash = (payload: string): string =>
      crypto.createHash('sha256').update(payload).digest('hex');

    // 1. Over / Under Lines (0.5, 1.5, 2.5, 3.5, 4.5)
    const ouLines = [
      { line: 0.5, over: rawMatch.odds_ft_over05, under: rawMatch.odds_ft_under05 },
      { line: 1.5, over: rawMatch.odds_ft_over15, under: rawMatch.odds_ft_under15 },
      { line: 2.5, over: rawMatch.odds_ft_over25, under: rawMatch.odds_ft_under25 },
      { line: 3.5, over: rawMatch.odds_ft_over35, under: rawMatch.odds_ft_under35 },
      { line: 4.5, over: rawMatch.odds_ft_over45, under: rawMatch.odds_ft_under45 },
    ];

    for (const item of ouLines) {
      const lineType = classifyLineType(item.line);

      // OVER
      if (item.over !== undefined && item.over !== null && Number(item.over) > 1.0) {
        const price = Number(item.over);
        const rawHash = computeHash(`${matchId}|OU|OVER|${item.line}|${price}`);
        records.push({
          provider: 'FOOTYSTATS',
          providerMatchId: matchId,
          bookmaker: null,
          oddsProvenanceStatus: 'INCOMPLETE',
          market: 'OU',
          selection: 'OVER',
          line: item.line,
          lineType,
          price,
          capturedAtUtc,
          rawSourceTimestampUtc: null,
          oddsTimestampUtc: null,
          oddsFreshnessStatus: 'UNKNOWN',
          clvUsable: false,
          sourceEndpoint: endpoint,
          rawRecordHash: rawHash,
        });
      }

      // UNDER
      if (item.under !== undefined && item.under !== null && Number(item.under) > 1.0) {
        const price = Number(item.under);
        const rawHash = computeHash(`${matchId}|OU|UNDER|${item.line}|${price}`);
        records.push({
          provider: 'FOOTYSTATS',
          providerMatchId: matchId,
          bookmaker: null,
          oddsProvenanceStatus: 'INCOMPLETE',
          market: 'OU',
          selection: 'UNDER',
          line: item.line,
          lineType,
          price,
          capturedAtUtc,
          rawSourceTimestampUtc: null,
          oddsTimestampUtc: null,
          oddsFreshnessStatus: 'UNKNOWN',
          clvUsable: false,
          sourceEndpoint: endpoint,
          rawRecordHash: rawHash,
        });
      }
    }

    // 2. Both Teams To Score (YES / NO)
    const bttsYes = rawMatch.odds_btts_yes;
    if (bttsYes !== undefined && bttsYes !== null && Number(bttsYes) > 1.0) {
      const price = Number(bttsYes);
      const rawHash = computeHash(`${matchId}|BTTS|YES|${price}`);
      records.push({
        provider: 'FOOTYSTATS',
        providerMatchId: matchId,
        bookmaker: null,
        oddsProvenanceStatus: 'INCOMPLETE',
        market: 'BTTS',
        selection: 'YES',
        line: null,
        lineType: 'NONE',
        price,
        capturedAtUtc,
        rawSourceTimestampUtc: null,
        oddsTimestampUtc: null,
        oddsFreshnessStatus: 'UNKNOWN',
        clvUsable: false,
        sourceEndpoint: endpoint,
        rawRecordHash: rawHash,
      });
    }

    const bttsNo = rawMatch.odds_btts_no;
    if (bttsNo !== undefined && bttsNo !== null && Number(bttsNo) > 1.0) {
      const price = Number(bttsNo);
      const rawHash = computeHash(`${matchId}|BTTS|NO|${price}`);
      records.push({
        provider: 'FOOTYSTATS',
        providerMatchId: matchId,
        bookmaker: null,
        oddsProvenanceStatus: 'INCOMPLETE',
        market: 'BTTS',
        selection: 'NO',
        line: null,
        lineType: 'NONE',
        price,
        capturedAtUtc,
        rawSourceTimestampUtc: null,
        oddsTimestampUtc: null,
        oddsFreshnessStatus: 'UNKNOWN',
        clvUsable: false,
        sourceEndpoint: endpoint,
        rawRecordHash: rawHash,
      });
    }

    return records;
  }
}
