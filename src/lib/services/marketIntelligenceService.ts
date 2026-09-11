import * as fs from 'fs';
import * as path from 'path';

import { type DataState } from '@/lib/data/dataState';

// ============================================================================
// Market intelligence service — REAL EVIDENCE ONLY.
// ============================================================================
// Source of truth: data/reports/homepage_backtest_latest.json, the persisted
// walk-forward backtest (expanding window, real closing odds).
//
// The previous EPIC-66 "market discovery" artifact
// (data/reports/epic66_market_discovery.json) is QUARANTINED: its own coverage
// matrix reports 0 Pinnacle odds rows while the discovery rankings claim
// triple-digit ROI with p=0. Per the no-extraordinary-result-without-audit
// invariant, those rankings are not served as product claims.
//
// Metrics that are not present in the verified artifact are returned as null
// and labelled with a data state. Never fabricated.

export type DiscoveryMarket = 'AH' | 'OU' | 'BTTS' | 'ML';

export interface MarketDiscoveryItem {
  id: string;
  market: DiscoveryMarket;
  dimension: string;
  identifier: string;
  leagueId: string;
  season: string;
  side: string;
  line?: number;
  bets: number;
  wins: number;
  halfWins: number;
  pushes: number;
  halfLosses: number;
  losses: number;
  hitRatePct: number;
  totalStaked: number;
  totalProfit: number;
  roiPct: number;
  avgOdds: number | null;
  maxDrawdown: number | null;
  maxLosingStreak: number | null;
  tStat: number | null;
  pValue: number | null;
  fdrQValue?: number | null;
  tier: 'RED' | 'GREY' | 'YELLOW' | 'GREEN' | 'GOLD';
  clvPct?: number | null;
  brierScore?: number | null;
  outOfSampleRoiPct?: number | null;
  outOfSampleBets?: number | null;
}

export interface MarketIntelligenceSummary {
  version: string;
  totalEvaluated: number;
  /** EPIC-66 discovery data is withheld from product claims pending audit. */
  discoveryStatus: 'QUARANTINED_PENDING_AUDIT' | 'VERIFIED';
  discoveryNote: string;
  topRankings: MarketDiscoveryItem[];
  bottomRankings: MarketDiscoveryItem[];
  asianHandicap: {
    bestOverall: MarketDiscoveryItem | null;
    mostRobust: MarketDiscoveryItem | null;
    promotedLines: MarketDiscoveryItem[];
  };
  overUnder: {
    baselineOver25RoiPct: number | null;
    baselineUnder25RoiPct: number | null;
    highScoringLeagues: Array<{ league: string; avgGoals: number; bttsRatePct: number }>;
  };
  btts: {
    topLeagues: Array<{ league: string; ratePct: number; bets: number; roiPct: number }>;
    bottomLeagues: Array<{ league: string; ratePct: number; bets: number; roiPct: number }>;
  };
  generatedAt: string;
  dataState: DataState;
  sourceFile: string | null;
}

let cachedIntelligence: { data: MarketIntelligenceSummary; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

const BACKTEST_FILE = 'data/reports/homepage_backtest_latest.json';

function loadBacktest(): any | null {
  try {
    const file = path.resolve(BACKTEST_FILE);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.warn('[MarketIntelligenceService] Failed to read backtest artifact:', err);
    return null;
  }
}

function toDiscoveryItem(raw: any, windowStart: string, windowEnd: string): MarketDiscoveryItem {
  const bets = Number(raw.totalBets ?? 0);
  const winRatePct = Number(raw.winRate ?? 0);
  const wins = Math.round((winRatePct / 100) * bets);

  return {
    id: `walkforward-${String(raw.market ?? 'UNKNOWN').toLowerCase()}`,
    market: raw.market as DiscoveryMarket,
    dimension: 'WALK_FORWARD',
    identifier: `${raw.market} walk-forward`,
    leagueId: 'TOP5_EUROPE',
    season: `${windowStart}..${windowEnd}`,
    side: 'ALL',
    bets,
    wins,
    halfWins: 0,
    pushes: 0,
    halfLosses: 0,
    losses: Math.max(0, bets - wins),
    hitRatePct: winRatePct,
    totalStaked: Number(raw.totalStaked ?? bets),
    totalProfit: Number(raw.profitUnits ?? 0),
    roiPct: Number(raw.roiPct ?? 0),
    avgOdds: raw.avgOdds != null ? Number(raw.avgOdds) : null,
    maxDrawdown: raw.maxDrawdown != null ? Number(raw.maxDrawdown) : null,
    maxLosingStreak: null,
    tStat: null,
    pValue: null,
    tier: 'GREY', // market-level CI not present in the artifact → inconclusive
    clvPct: raw.avgClvPct != null ? Number(raw.avgClvPct) : null,
    brierScore: raw.brierScore != null ? Number(raw.brierScore) : null,
    outOfSampleRoiPct: Number(raw.roiPct ?? 0),
    outOfSampleBets: bets,
  };
}

export class MarketIntelligenceService {
  public static getMarketDiscovery(options: {
    market?: DiscoveryMarket | 'all';
    tier?: 'GOLD' | 'GREEN' | 'YELLOW' | 'RED' | 'GREY' | 'all';
    limit?: number;
  } = {}): MarketDiscoveryItem[] {
    const { market = 'all', tier = 'all', limit = 50 } = options;
    const summary = this.getIntelligenceSummary();

    let list = [...summary.topRankings];
    if (market !== 'all') {
      list = list.filter((r) => r.market === market);
    }
    if (tier !== 'all') {
      list = list.filter((r) => r.tier === tier);
    }

    return list.slice(0, limit);
  }

  public static getIntelligenceSummary(): MarketIntelligenceSummary {
    if (cachedIntelligence && Date.now() - cachedIntelligence.timestamp < CACHE_TTL_MS) {
      return cachedIntelligence.data;
    }

    const backtest = loadBacktest();
    const items: MarketDiscoveryItem[] = [];
    const windowStart = String(backtest?.windowStart ?? '');
    const windowEnd = String(backtest?.windowEnd ?? '');

    if (backtest && Array.isArray(backtest.markets)) {
      for (const raw of backtest.markets) {
        if (!raw || !raw.market) continue;
        items.push(toDiscoveryItem(raw, windowStart, windowEnd));
      }
    }

    const ahItem = items.find((i) => i.market === 'AH') ?? null;
    const ouItem = items.find((i) => i.market === 'OU') ?? null;

    const summary: MarketIntelligenceSummary = {
      version: 'walkforward-v1',
      totalEvaluated: items.length,
      discoveryStatus: 'QUARANTINED_PENDING_AUDIT',
      discoveryNote:
        'EPIC-66 market discovery rankings are withheld pending audit: the coverage matrix reports zero Pinnacle odds rows while the rankings claim implausible ROI. Only the persisted walk-forward backtest is served.',
      topRankings: [...items].sort((a, b) => b.roiPct - a.roiPct),
      bottomRankings: [...items].sort((a, b) => a.roiPct - b.roiPct).slice(0, 10),
      asianHandicap: {
        bestOverall: ahItem,
        mostRobust: ahItem,
        promotedLines: [],
      },
      overUnder: {
        baselineOver25RoiPct: ouItem ? ouItem.roiPct : null,
        baselineUnder25RoiPct: null,
        highScoringLeagues: [],
      },
      btts: {
        topLeagues: [],
        bottomLeagues: [],
      },
      generatedAt: new Date().toISOString(),
      dataState: backtest ? 'REAL' : 'DATA_UNAVAILABLE',
      sourceFile: backtest ? BACKTEST_FILE : null,
    };

    cachedIntelligence = { data: summary, timestamp: Date.now() };
    return summary;
  }
}
