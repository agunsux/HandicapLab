import { z } from 'zod';

export const RawFootyStatsMatchSchema = z.object({
  id: z.number(),
  homeID: z.number(),
  awayID: z.number(),
  season: z.union([z.string(), z.number()]).optional(),
  status: z.string(),
  roundID: z.number().optional().nullable(),
  game_week: z.number().optional().nullable(),
  home_name: z.string(),
  away_name: z.string(),
  homeGoalCount: z.number().optional().nullable(),
  awayGoalCount: z.number().optional().nullable(),
  totalGoalCount: z.number().optional().nullable(),
  date_unix: z.number(),
  btts: z.union([z.number(), z.string(), z.boolean()]).optional().nullable(),

  // 1X2 odds
  odds_ft_1: z.union([z.number(), z.string()]).optional().nullable(),
  odds_ft_x: z.union([z.number(), z.string()]).optional().nullable(),
  odds_ft_2: z.union([z.number(), z.string()]).optional().nullable(),

  // BTTS odds
  odds_btts_yes: z.union([z.number(), z.string()]).optional().nullable(),
  odds_btts_no: z.union([z.number(), z.string()]).optional().nullable(),

  // Over / Under odds
  odds_ft_over05: z.union([z.number(), z.string()]).optional().nullable(),
  odds_ft_over15: z.union([z.number(), z.string()]).optional().nullable(),
  odds_ft_over25: z.union([z.number(), z.string()]).optional().nullable(),
  odds_ft_over35: z.union([z.number(), z.string()]).optional().nullable(),
  odds_ft_over45: z.union([z.number(), z.string()]).optional().nullable(),

  odds_ft_under05: z.union([z.number(), z.string()]).optional().nullable(),
  odds_ft_under15: z.union([z.number(), z.string()]).optional().nullable(),
  odds_ft_under25: z.union([z.number(), z.string()]).optional().nullable(),
  odds_ft_under35: z.union([z.number(), z.string()]).optional().nullable(),
  odds_ft_under45: z.union([z.number(), z.string()]).optional().nullable(),

  // Clean Sheet odds
  odds_team_a_cs_yes: z.union([z.number(), z.string()]).optional().nullable(),
  odds_team_a_cs_no: z.union([z.number(), z.string()]).optional().nullable(),
  odds_team_b_cs_yes: z.union([z.number(), z.string()]).optional().nullable(),
  odds_team_b_cs_no: z.union([z.number(), z.string()]).optional().nullable(),
}).passthrough();

export type RawFootyStatsMatch = z.infer<typeof RawFootyStatsMatchSchema>;

export const FootyStatsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  pager: z.object({
    current_page: z.number().optional(),
    max_page: z.number().optional(),
    results_per_page: z.number().optional(),
    total_results: z.number().optional(),
  }).optional(),
  data: z.array(RawFootyStatsMatchSchema),
}).passthrough();

export type FootyStatsResponse = z.infer<typeof FootyStatsResponseSchema>;

export type ProxyProvenance = 'footystats_proxy';

export interface NormalizedProxyOddsRecord {
  fixtureKey: string;
  season: string;
  date_unix: number;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  market: '1X2' | 'BTTS' | 'OU' | 'CS_A' | 'CS_B';
  line: number | null;
  side: string;
  odds: number;
  provenance: ProxyProvenance;
  oddsTimestamp: null;
  bookmaker: null;
  sourceFile: string;
  sourceRow: number;
}

export interface MarketCoverageStats {
  totalFixtures: number;
  pricedOddsCount: number;
  fillRatePct: number;
}

export interface SeasonCoverageReport {
  season: string;
  seasonId: number;
  fromCache: boolean;
  fixtureCount: number;
  completedFixtureCount: number;
  statusMessage?: string;
  fields: {
    scoresValidCount: number;
    scoresValidPct: number;
    odds1x2QuotedCount: number;
    odds1x2FillRatePct: number;
    oddsBttsQuotedCount: number;
    oddsBttsFillRatePct: number;
    oddsOu25QuotedCount: number;
    oddsOu25FillRatePct: number;
    oddsOuOtherQuotedCount: number;
    oddsCsQuotedCount: number;
  };
}

export interface FootyStatsCoverageOutput {
  generatedAt: string;
  pilotScope: string[];
  gateGD: {
    targetMetric: 'odds_btts_yes/no fill rate on EPL matched fixtures >= 80%';
    thresholdPct: 80.0;
    actualPct: number;
    status: 'PASS' | 'BLOCKED';
  };
  providerAudit: {
    footystatsRequestsThisRun: number;
    apiFootballRequestsThisRun: 0;
    oddsPapiRequestsThisRun: 0;
  };
  seasons: Record<string, SeasonCoverageReport>;
  normalizationSummary: {
    totalNormalizedOddsRows: number;
    byMarket: Record<string, number>;
  };
}
