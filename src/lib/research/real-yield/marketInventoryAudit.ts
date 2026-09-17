import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';

interface CanonicalMatch {
  canonicalId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

interface MarketOddsRow {
  odds_id: string;
  canonical_id: string;
  league_id: string;
  season: string;
  match_date: string;
  market: 'AH' | 'ML' | 'OU';
  observation: 'opening' | 'closing';
  bookmaker_source: 'pinnacle' | 'betbrain' | 'bet365';
  line: number | null;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  over_odds: number | null;
  under_odds: number | null;
}

export interface LineInventory {
  line: number | null;
  totalCount: number;
  validOddsCount: number;
  missingOrInvalidCount: number;
  seasons: Record<string, number>;
  leagues: Record<string, number>;
  oddsMin: number;
  oddsMax: number;
}

export interface MarketAuditResult {
  datasetHash: string;
  matchesCount: number;
  oddsRowCount: number;
  bookmakerCoverage: Record<string, Record<string, Record<string, number>>>; // bookmaker -> observation -> market -> count
  ahLinesByBookmaker: Record<string, Record<string, Record<string, LineInventory>>>; // bookmaker -> observation -> line -> LineInventory
  ouLinesByBookmaker: Record<string, Record<string, Record<string, LineInventory>>>;
  mlByBookmaker: Record<string, Record<string, LineInventory>>;
  seasonsSummary: Record<string, { matches: number; pinnacleOpeningAh: number; pinnacleOpeningOu: number; pinnacleOpeningMl: number }>;
}

function computeSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function runMarketInventoryAudit(): Promise<MarketAuditResult> {
  const matchesPath = path.resolve(process.cwd(), 'data/golden/europe/canonical_matches.jsonl');
  const oddsPath = path.resolve(process.cwd(), 'data/golden/europe/market_odds.jsonl');

  const matchesHash = computeSha256(matchesPath);
  const oddsHash = computeSha256(oddsPath);
  const combinedHash = crypto
    .createHash('sha256')
    .update(matchesHash.toLowerCase() + oddsHash.toLowerCase())
    .digest('hex');

  const matchesMap = new Map<string, CanonicalMatch>();
  const matchRl = readline.createInterface({
    input: fs.createReadStream(matchesPath, 'utf-8'),
    crlfDelay: Infinity,
  });

  const seasonsSummary: Record<string, { matches: number; pinnacleOpeningAh: number; pinnacleOpeningOu: number; pinnacleOpeningMl: number }> = {};

  for await (const line of matchRl) {
    if (!line.trim()) continue;
    const m = JSON.parse(line) as CanonicalMatch;
    matchesMap.set(m.canonicalId, m);
    if (!seasonsSummary[m.season]) {
      seasonsSummary[m.season] = { matches: 0, pinnacleOpeningAh: 0, pinnacleOpeningOu: 0, pinnacleOpeningMl: 0 };
    }
    seasonsSummary[m.season].matches++;
  }

  const bookmakerCoverage: Record<string, Record<string, Record<string, number>>> = {};
  const ahLinesByBookmaker: Record<string, Record<string, Record<string, LineInventory>>> = {};
  const ouLinesByBookmaker: Record<string, Record<string, Record<string, LineInventory>>> = {};
  const mlByBookmaker: Record<string, Record<string, LineInventory>> = {};

  const oddsRl = readline.createInterface({
    input: fs.createReadStream(oddsPath, 'utf-8'),
    crlfDelay: Infinity,
  });

  let oddsRowCount = 0;

  for await (const line of oddsRl) {
    if (!line.trim()) continue;
    oddsRowCount++;
    const o = JSON.parse(line) as MarketOddsRow;
    const bm = o.bookmaker_source;
    const obs = o.observation;
    const mkt = o.market;

    // Bookmaker coverage
    if (!bookmakerCoverage[bm]) bookmakerCoverage[bm] = {};
    if (!bookmakerCoverage[bm][obs]) bookmakerCoverage[bm][obs] = {};
    bookmakerCoverage[bm][obs][mkt] = (bookmakerCoverage[bm][obs][mkt] || 0) + 1;

    // Track Pinnacle opening by season
    if (bm === 'pinnacle' && obs === 'opening') {
      const s = o.season;
      if (seasonsSummary[s]) {
        if (mkt === 'AH') seasonsSummary[s].pinnacleOpeningAh++;
        if (mkt === 'OU') seasonsSummary[s].pinnacleOpeningOu++;
        if (mkt === 'ML') seasonsSummary[s].pinnacleOpeningMl++;
      }
    }

    // Process AH
    if (mkt === 'AH') {
      if (!ahLinesByBookmaker[bm]) ahLinesByBookmaker[bm] = {};
      if (!ahLinesByBookmaker[bm][obs]) ahLinesByBookmaker[bm][obs] = {};
      const lineKey = o.line === null ? 'null' : String(o.line);
      if (!ahLinesByBookmaker[bm][obs][lineKey]) {
        ahLinesByBookmaker[bm][obs][lineKey] = {
          line: o.line,
          totalCount: 0,
          validOddsCount: 0,
          missingOrInvalidCount: 0,
          seasons: {},
          leagues: {},
          oddsMin: Infinity,
          oddsMax: -Infinity,
        };
      }
      const inv = ahLinesByBookmaker[bm][obs][lineKey];
      inv.totalCount++;
      inv.seasons[o.season] = (inv.seasons[o.season] || 0) + 1;
      inv.leagues[o.league_id] = (inv.leagues[o.league_id] || 0) + 1;

      const validHome = typeof o.home_odds === 'number' && o.home_odds > 1.0;
      const validAway = typeof o.away_odds === 'number' && o.away_odds > 1.0;
      if (validHome && validAway) {
        inv.validOddsCount++;
        inv.oddsMin = Math.min(inv.oddsMin, o.home_odds!, o.away_odds!);
        inv.oddsMax = Math.max(inv.oddsMax, o.home_odds!, o.away_odds!);
      } else {
        inv.missingOrInvalidCount++;
      }
    }

    // Process OU
    if (mkt === 'OU') {
      if (!ouLinesByBookmaker[bm]) ouLinesByBookmaker[bm] = {};
      if (!ouLinesByBookmaker[bm][obs]) ouLinesByBookmaker[bm][obs] = {};
      const lineKey = o.line === null ? 'null' : String(o.line);
      if (!ouLinesByBookmaker[bm][obs][lineKey]) {
        ouLinesByBookmaker[bm][obs][lineKey] = {
          line: o.line,
          totalCount: 0,
          validOddsCount: 0,
          missingOrInvalidCount: 0,
          seasons: {},
          leagues: {},
          oddsMin: Infinity,
          oddsMax: -Infinity,
        };
      }
      const inv = ouLinesByBookmaker[bm][obs][lineKey];
      inv.totalCount++;
      inv.seasons[o.season] = (inv.seasons[o.season] || 0) + 1;
      inv.leagues[o.league_id] = (inv.leagues[o.league_id] || 0) + 1;

      const validOver = typeof o.over_odds === 'number' && o.over_odds > 1.0;
      const validUnder = typeof o.under_odds === 'number' && o.under_odds > 1.0;
      if (validOver && validUnder) {
        inv.validOddsCount++;
        inv.oddsMin = Math.min(inv.oddsMin, o.over_odds!, o.under_odds!);
        inv.oddsMax = Math.max(inv.oddsMax, o.over_odds!, o.under_odds!);
      } else {
        inv.missingOrInvalidCount++;
      }
    }

    // Process ML
    if (mkt === 'ML') {
      if (!mlByBookmaker[bm]) mlByBookmaker[bm] = {};
      const obsKey = obs;
      if (!mlByBookmaker[bm][obsKey]) {
        mlByBookmaker[bm][obsKey] = {
          line: null,
          totalCount: 0,
          validOddsCount: 0,
          missingOrInvalidCount: 0,
          seasons: {},
          leagues: {},
          oddsMin: Infinity,
          oddsMax: -Infinity,
        };
      }
      const inv = mlByBookmaker[bm][obsKey];
      inv.totalCount++;
      inv.seasons[o.season] = (inv.seasons[o.season] || 0) + 1;
      inv.leagues[o.league_id] = (inv.leagues[o.league_id] || 0) + 1;

      const validHome = typeof o.home_odds === 'number' && o.home_odds > 1.0;
      const validDraw = typeof o.draw_odds === 'number' && o.draw_odds > 1.0;
      const validAway = typeof o.away_odds === 'number' && o.away_odds > 1.0;
      if (validHome && validDraw && validAway) {
        inv.validOddsCount++;
        inv.oddsMin = Math.min(inv.oddsMin, o.home_odds!, o.draw_odds!, o.away_odds!);
        inv.oddsMax = Math.max(inv.oddsMax, o.home_odds!, o.draw_odds!, o.away_odds!);
      } else {
        inv.missingOrInvalidCount++;
      }
    }
  }

  return {
    datasetHash: combinedHash,
    matchesCount: matchesMap.size,
    oddsRowCount,
    bookmakerCoverage,
    ahLinesByBookmaker,
    ouLinesByBookmaker,
    mlByBookmaker,
    seasonsSummary,
  };
}

// If run directly as a script
if (require.main === module || process.argv[1]?.includes('marketInventoryAudit')) {
  runMarketInventoryAudit().then((res) => {
    const outPath = path.resolve(process.cwd(), 'data/verification/REAL_MARKET_INVENTORY_AUDIT.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(res, null, 2), 'utf-8');
    console.log('Successfully generated REAL_MARKET_INVENTORY_AUDIT.json');
    console.log('Dataset Hash:', res.datasetHash);
    console.log('Total Matches:', res.matchesCount);
    console.log('Total Odds Rows:', res.oddsRowCount);
    console.log('Pinnacle Opening Coverage:');
    console.log(JSON.stringify(res.bookmakerCoverage.pinnacle?.opening, null, 2));
    console.log('Seasons Summary:');
    console.log(JSON.stringify(res.seasonsSummary, null, 2));
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

