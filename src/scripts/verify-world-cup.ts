import { supabase } from '../lib/supabase.server';
import { fetchUpcomingFixtures } from '../lib/api/apiFootball';
import { runPredictionCron } from '../lib/crons/prediction';
import 'dotenv/config';

// 1. Initialize local in-memory DB to mock Supabase tables
const db: Record<string, any[]> = {
  matches: [],
  predictions: [],
  paper_trades: [],
  odds_history: []
};

// Seed historical finished matches to allow Form/xG/ELO extractors to calculate realistic data
const historicalMatches = [
  { id: 'h1', home_team: 'Argentina', away_team: 'France', league: 'FIFA World Cup', kickoff: '2022-12-18T15:00:00Z', status: 'finished', home_goals: 3, away_goals: 3, ht_home_goals: 2, ht_away_goals: 0 },
  { id: 'h2', home_team: 'Croatia', away_team: 'Brazil', league: 'FIFA World Cup', kickoff: '2022-12-09T15:00:00Z', status: 'finished', home_goals: 1, away_goals: 1, ht_home_goals: 0, ht_away_goals: 0 },
  { id: 'h3', home_team: 'England', away_team: 'France', league: 'FIFA World Cup', kickoff: '2022-12-10T19:00:00Z', status: 'finished', home_goals: 1, away_goals: 2, ht_home_goals: 0, ht_away_goals: 1 },
  { id: 'h4', home_team: 'Spain', away_team: 'Germany', league: 'FIFA World Cup', kickoff: '2022-11-27T19:00:00Z', status: 'finished', home_goals: 1, away_goals: 1, ht_home_goals: 0, ht_away_goals: 0 },
  { id: 'h5', home_team: 'Portugal', away_team: 'Spain', league: 'FIFA World Cup', kickoff: '2018-06-15T18:00:00Z', status: 'finished', home_goals: 3, away_goals: 3, ht_home_goals: 2, ht_away_goals: 1 }
];
db.matches.push(...historicalMatches);

class InsertBuilder {
  private isSingle = false;
  constructor(private insertedData: any) {}
  select() { return this; }
  single() {
    this.isSingle = true;
    return this;
  }
  async then(resolve: any) {
    const data = this.isSingle 
      ? (Array.isArray(this.insertedData) ? this.insertedData[0] : this.insertedData)
      : this.insertedData;
    resolve({ data, error: null });
  }
}

class UpdateBuilder {
  private isSingle = false;
  constructor(
    private table: string,
    private dbData: any[],
    private filters: ((item: any) => boolean)[],
    private payload: any
  ) {}

  select() { return this; }
  single() {
    this.isSingle = true;
    return this;
  }

  async then(resolve: any) {
    let matched = [...this.dbData];
    for (const filter of this.filters) {
      matched = matched.filter(filter);
    }

    for (const item of matched) {
      Object.assign(item, this.payload, { updated_at: new Date().toISOString() });
    }

    const data = this.isSingle ? (matched[0] || null) : matched;
    resolve({ data, error: null });
  }
}

class QueryBuilder {
  private filters: ((item: any) => boolean)[] = [];
  private orderCol: string = '';
  private ascending: boolean = true;
  private limitVal: number = 999;
  private isSingle = false;

  constructor(private table: string, private data: any[]) {}

  select() { return this; }

  eq(col: string, val: any) {
    this.filters.push(item => String(item[col]) === String(val));
    return this;
  }

  in(col: string, vals: any[]) {
    const stringVals = vals.map(v => String(v));
    this.filters.push(item => stringVals.includes(String(item[col])));
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push(item => item[col] >= val);
    return this;
  }

  lt(col: string, val: any) {
    this.filters.push(item => item[col] < val);
    return this;
  }

  or(expr: string) {
    // Mock simple team points or query
    if (expr.includes('home_team.eq') && expr.includes('away_team.eq')) {
      const matchTeam = expr.match(/"([^"]+)"/g);
      if (matchTeam) {
        const teamName = matchTeam[0].replace(/"/g, '');
        this.filters.push(item => item.home_team === teamName || item.away_team === teamName);
      }
    }
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderCol = col;
    this.ascending = options?.ascending ?? true;
    return this;
  }

  limit(val: number) {
    this.limitVal = val;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  insert(payload: any) {
    const records = Array.isArray(payload) ? payload : [payload];
    const inserted: any[] = [];
    for (const rec of records) {
      const newRec = { 
        id: 'm-' + Math.random().toString(36).substring(7), 
        created_at: new Date().toISOString(), 
        home_goals: null,
        away_goals: null,
        ...rec 
      };
      this.data.push(newRec);
      inserted.push(newRec);
    }
    return new InsertBuilder(this.isSingle ? inserted[0] : inserted);
  }

  update(payload: any) {
    return new UpdateBuilder(this.table, this.data, this.filters, payload);
  }

  async then(resolve: any) {
    let result = [...this.data];
    for (const filter of this.filters) {
      result = result.filter(filter);
    }

    if (this.orderCol) {
      result.sort((a, b) => {
        const valA = a[this.orderCol];
        const valB = b[this.orderCol];
        if (valA < valB) return this.ascending ? -1 : 1;
        if (valA > valB) return this.ascending ? 1 : -1;
        return 0;
      });
    }

    result = result.slice(0, this.limitVal);

    if (this.isSingle) {
      resolve({ data: result[0] || null, error: null });
    } else {
      resolve({ data: result, error: null, count: result.length });
    }
  }
}

// Intercept Supabase client functions
supabase.from = (table: string) => {
  return new QueryBuilder(table, db[table] || []) as any;
};

async function runAudit() {
  console.log('🤖 Starting E2E World Cup Verification Audit (In-Memory Simulation)...');

  // ==================================
  // Ingest World Cup Fixtures
  // ==================================
  console.log('\n📡 [Ingestion] Fetching mock upcoming World Cup fixtures...');
  const fixtures = await fetchUpcomingFixtures(1, 2026);
  console.log(`✅ Ingested ${fixtures.length} fixtures from client.`);

  for (const f of fixtures) {
    const kickoffTime = f.fixture.date;
    await supabase.from('matches').insert({
      home_team: f.teams.home.name,
      away_team: f.teams.away.name,
      league: 'FIFA World Cup',
      league_id: 1,
      kickoff: kickoffTime,
      status: 'upcoming',
      competition_type: 'international',
      tournament_stage: f.league.round || 'Group Stage',
      home_goals: null,
      away_goals: null
    });
  }

  // ==================================
  // Trigger Pipeline
  // ==================================
  console.log('\n🔮 [Prediction] Running prediction engine on upcoming matches...');
  await runPredictionCron();
  console.log('✅ Prediction Cron completed.');

  // ==================================
  // 1. WORLD CUP FIXTURE CHECK
  // ==================================
  console.log('\n==================================');
  console.log('1. WORLD CUP FIXTURE CHECK');
  console.log('==================================');
  const queryDate = '2026-06-27T00:00:00Z';
  const wcMatches = db.matches.filter(m => 
    m.status === 'upcoming' &&
    m.league === 'FIFA World Cup' &&
    m.kickoff >= queryDate
  );

  console.log(`Fixture Count (>= 2026-06-27): ${wcMatches.length}`);
  wcMatches.forEach((m, idx) => {
    console.log(`[Fixture #${idx + 1}] Date: ${m.kickoff} | Teams: ${m.home_team} vs ${m.away_team} | competition_id: world_cup_2026`);
  });

  // ==================================
  // 2. PREDICTION GENERATION CHECK
  // ==================================
  console.log('\n==================================');
  console.log('2. PREDICTION GENERATION CHECK');
  console.log('==================================');
  const wcMatchIds = wcMatches.map(m => m.id);
  const wcPredictions = db.predictions.filter(p => wcMatchIds.includes(p.match_id));

  console.log(`Predictions Count: ${wcPredictions.length}`);
  wcPredictions.forEach((p, idx) => {
    const predData = p.prediction;
    const confidenceVal = predData.confidence?.finalConfidence !== undefined 
      ? (predData.confidence.finalConfidence * 100).toFixed(1) + '%' 
      : 'N/A';
    
    console.log(`[Prediction #${idx + 1}] Match ID: ${p.match_id} | Market: ${p.market_type}`);
    console.log(`  Probs: Home: ${(predData.pHome*100).toFixed(1)}% | Draw: ${(predData.pDraw*100).toFixed(1)}% | Away: ${(predData.pAway*100).toFixed(1)}%`);
    console.log(`  Line: ${p.market_subtype || 'N/A'} | Odds: ${p.entry_odds} | Confidence: ${confidenceVal}`);
  });

  // ==================================
  // 3. EDGE FILTER CHECK
  // ==================================
  console.log('\n==================================');
  console.log('3. EDGE FILTER CHECK');
  console.log('==================================');
  let totalPreds = db.predictions.filter(p => p.match_id.startsWith('m-')).length;
  let evPositive = 0;
  let confidenceFiltered = 0;

  db.predictions.forEach(p => {
    if (!p.match_id.startsWith('m-')) return;
    const edge = p.edge_pct ?? 0.0;
    if (edge > 0) evPositive++;

    const conf = p.prediction?.confidence?.finalConfidence ?? 1.0;
    // Suppose low confidence is <0.50
    if (conf < 0.50) confidenceFiltered++;
  });

  console.log(`Total predictions:          ${totalPreds}`);
  console.log(`EV positive count:          ${evPositive}`);
  console.log(`Confidence filtered count:  ${confidenceFiltered}`);

  // ==================================
  // 4. PAPER TRADING CHECK
  // ==================================
  console.log('\n==================================');
  console.log('4. PAPER TRADING CHECK');
  console.log('==================================');
  const wcTrades = db.paper_trades.filter(t => wcMatchIds.includes(t.match_id));

  console.log(`Paper Trades Count: ${wcTrades.length}`);
  wcTrades.forEach((t, idx) => {
    console.log(`[Trade #${idx + 1}]`);
    console.log(`  competition_id: ${t.competition_id}`);
    console.log(`  match_id:       ${t.match_id}`);
    console.log(`  market_type:    ${t.market_type}`);
    console.log(`  odds:           ${t.entry_odds}`);
    console.log(`  stake:          ${t.stake}`);
    console.log(`  status:         ${t.status}`);
  });

  // ==================================
  // 5. QUALITY AUDIT
  // ==================================
  console.log('\n==================================');
  console.log('5. QUALITY AUDIT');
  console.log('==================================');
  let under50 = 0;
  let range50to60 = 0;
  let range60to70 = 0;
  let range70to80 = 0;
  let over80 = 0;

  let sumConf = 0;
  let sumEv = 0;
  let countWC = 0;

  db.predictions.forEach(p => {
    if (!p.match_id.startsWith('m-')) return;
    const confVal = p.prediction?.confidence?.finalConfidence ?? 0;
    const edge = p.edge_pct ?? 0;

    sumConf += confVal;
    sumEv += edge;
    countWC++;

    const pct = confVal * 100;
    if (pct < 50) under50++;
    else if (pct < 60) range50to60++;
    else if (pct < 70) range60to70++;
    else if (pct < 80) range70to80++;
    else over80++;

    if (confVal > 0.85) {
      console.log(`🚩 [FLAG HIGH] High Confidence (>85%): ${p.home_team} vs ${p.away_team} (${p.market_type}) = ${(confVal*100).toFixed(1)}%`);
    }
    if (confVal < 0.45) {
      console.log(`🚩 [FLAG LOW] Low Confidence (<45%): ${p.home_team} vs ${p.away_team} (${p.market_type}) = ${(confVal*100).toFixed(1)}%`);
    }
  });

  console.log('\nConfidence Distribution:');
  console.log(`  - <50:   ${under50}`);
  console.log(`  - 50-60: ${range50to60}`);
  console.log(`  - 60-70: ${range60to70}`);
  console.log(`  - 70-80: ${range70to80}`);
  console.log(`  - 80+:   ${over80}`);

  // ==================================
  // 6. DASHBOARD SNAPSHOT REPORT
  // ==================================
  const avgConf = countWC > 0 ? sumConf / countWC : 0;
  const avgEv = countWC > 0 ? sumEv / countWC : 0;

  console.log('\n==================================');
  console.log('6. CREATE WORLD CUP DASHBOARD SNAPSHOT');
  console.log('==================================');
  console.log('World Cup Tracking Status:');
  console.log(`  - Fixtures:         ${db.matches.filter(m => m.status === 'upcoming' && m.league === 'FIFA World Cup').length}`);
  console.log(`  - Predictions:      ${countWC}`);
  console.log(`  - Paper Trades:     ${db.paper_trades.length}`);
  console.log(`  - Average Confidence: ${(avgConf * 100).toFixed(2)}%`);
  console.log(`  - Average EV:         ${(avgEv * 100).toFixed(2)}%`);
  console.log('==================================\n');
}

runAudit().catch(err => {
  console.error('❌ E2E Audit script failed:', err);
  process.exit(1);
});
