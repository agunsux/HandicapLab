import * as fs from 'fs';
import * as path from 'path';

export interface MarketDiscoveryItem {
  id: string;
  market: 'AH' | 'OU' | 'BTTS';
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
  avgOdds: number;
  maxDrawdown: number;
  maxLosingStreak: number;
  tStat: number;
  pValue: number;
  fdrQValue?: number;
  tier: 'RED' | 'GREY' | 'YELLOW' | 'GREEN' | 'GOLD';
  clvPct?: number;
  outOfSampleRoiPct?: number;
  outOfSampleBets?: number;
}

export interface MarketIntelligenceSummary {
  version: string;
  totalEvaluated: number;
  topRankings: MarketDiscoveryItem[];
  bottomRankings: MarketDiscoveryItem[];
  asianHandicap: {
    bestOverall: MarketDiscoveryItem | null;
    mostRobust: MarketDiscoveryItem | null;
    promotedLines: MarketDiscoveryItem[];
  };
  overUnder: {
    baselineOver25RoiPct: number;
    baselineUnder25RoiPct: number;
    highScoringLeagues: Array<{ league: string; avgGoals: number; bttsRatePct: number }>;
  };
  btts: {
    topLeagues: Array<{ league: string; ratePct: number; bets: number; roiPct: number }>;
    bottomLeagues: Array<{ league: string; ratePct: number; bets: number; roiPct: number }>;
  };
  generatedAt: string;
}

let cachedIntelligence: { data: MarketIntelligenceSummary; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

export class MarketIntelligenceService {
  public static getMarketDiscovery(options: {
    market?: 'AH' | 'OU' | 'BTTS' | 'all';
    tier?: 'GOLD' | 'GREEN' | 'YELLOW' | 'RED' | 'all';
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

    let rawRankings: any[] = [];
    const clvMap = new Map<string, { clv: number; oosRoi: number; oosBets: number }>();

    try {
      // 1. Read walk-forward CLV and OOS facts
      const wfPath = path.resolve('data/reports/epic66_walkforward_report.json');
      if (fs.existsSync(wfPath)) {
        const wf = JSON.parse(fs.readFileSync(wfPath, 'utf-8'));
        for (const s of wf.strategies || []) {
          clvMap.set(s.strategyName.toUpperCase().trim(), {
            clv: s.modelClvMeanPct || 0,
            oosRoi: s.outOfSampleRoiPct || 0,
            oosBets: s.outOfSampleBets || 0,
          });
        }
      }

      // 2. Read market discovery
      const discoveryPath = path.resolve('data/reports/epic66_market_discovery.json');
      if (fs.existsSync(discoveryPath)) {
        const disc = JSON.parse(fs.readFileSync(discoveryPath, 'utf-8'));
        rawRankings = disc.rankings || [];
      }
    } catch (err) {
      console.warn('[MarketIntelligenceService] Error reading report JSON:', err);
    }

    const items: MarketDiscoveryItem[] = rawRankings.map((r, idx) => {
      const matchKey = r.identifier.toUpperCase().trim();
      const wfMatch = clvMap.get(matchKey);

      return {
        id: `mkt-${idx + 1}`,
        market: r.market,
        dimension: r.dimension,
        identifier: r.identifier,
        leagueId: r.leagueId,
        season: r.season,
        side: r.side,
        line: r.line,
        bets: r.bets,
        wins: r.wins,
        halfWins: r.halfWins,
        pushes: r.pushes,
        halfLosses: r.halfLosses,
        losses: r.losses,
        hitRatePct: r.hitRatePct,
        totalStaked: r.totalStaked,
        totalProfit: r.totalProfit,
        roiPct: r.roiPct,
        avgOdds: r.avgOdds,
        maxDrawdown: r.maxDrawdown,
        maxLosingStreak: r.maxLosingStreak,
        tStat: r.tStat,
        pValue: r.pValue,
        fdrQValue: r.fdrQValue,
        tier: r.tier,
        clvPct: wfMatch ? wfMatch.clv : undefined,
        outOfSampleRoiPct: wfMatch ? wfMatch.oosRoi : undefined,
        outOfSampleBets: wfMatch ? wfMatch.oosBets : undefined,
      };
    });

    // Extract AH specific
    const ahItems = items.filter((i) => i.market === 'AH');
    const mostRobustAh = ahItems.find((i) => i.identifier === 'AH +0.25 Away') || null;
    const bestOverallAh = ahItems.find((i) => i.identifier === 'AH +1.00 Away') || null;
    const promotedAh = ahItems.filter((i) => i.tier === 'GOLD' || i.tier === 'GREEN');

    // Extract BTTS specific
    const bttsItems = items.filter((i) => i.market === 'BTTS');
    const topBtts = bttsItems.slice(0, 5).map((b) => ({
      league: b.leagueId,
      ratePct: b.hitRatePct,
      bets: b.bets,
      roiPct: b.roiPct,
    }));
    const bottomBtts = bttsItems.slice(-3).map((b) => ({
      league: b.leagueId,
      ratePct: b.hitRatePct,
      bets: b.bets,
      roiPct: b.roiPct,
    }));

    const summary: MarketIntelligenceSummary = {
      version: 'epic66-v1.0',
      totalEvaluated: items.length,
      topRankings: items,
      bottomRankings: items.slice(-10),
      asianHandicap: {
        bestOverall: bestOverallAh,
        mostRobust: mostRobustAh,
        promotedLines: promotedAh,
      },
      overUnder: {
        baselineOver25RoiPct: -3.54,
        baselineUnder25RoiPct: -5.89,
        highScoringLeagues: [
          { league: 'DEU-BUNDESLIGA', avgGoals: 3.16, bttsRatePct: 59.58 },
          { league: 'CHE-SUPER', avgGoals: 3.22, bttsRatePct: 63.04 },
          { league: 'NLD-EREDIVISIE', avgGoals: 3.14, bttsRatePct: 58.89 },
          { league: 'USA-MLS', avgGoals: 3.12, bttsRatePct: 61.21 },
        ],
      },
      btts: {
        topLeagues: topBtts,
        bottomLeagues: bottomBtts,
      },
      generatedAt: new Date().toISOString(),
    };

    cachedIntelligence = { data: summary, timestamp: Date.now() };
    return summary;
  }
}
