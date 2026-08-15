// Real historical odds ingestion — extracts Pinnacle opening (entry) and closing
// odds for 1X2 / OU / AH from the football-data.co.uk CSVs that already exist in
// the repository (data/bronze/football_data/*.csv). Every record is REAL_PROVIDER
// data with an explicit entry/closing pair, enabling CLV computation.
//
// This is NOT synthetic data: PSH/PSD/PSA + PSCH/PSCD/PSCA are real Pinnacle odds;
// P>2.5/P<2.5 + PC>2.5/PC<2.5 are Pinnacle totals; PAHH/PAHA + PCAHH/PCAHA are
// Pinnacle Asian Handicap (incl. quarter lines).
//
// OddsPAPI is the supplementary real provider for recent windows (historical odds
// documented from Jan 2026); for the historical research window (2019-20 .. 2025-26)
// the Pinnacle opening/closing pair in these CSVs is the real source of truth.

import * as fs from 'fs';
import * as path from 'path';
import { settleAsianHandicap, settleAsianTotal } from '../settlement/settlement';

export const REAL_ODDS_OUT = path.resolve(process.cwd(), 'data', 'historical', 'real_odds.jsonl');

export type RealMarket = 'ML' | 'OU25' | 'AH';
export type RealOddsType = 'entry' | 'closing';

export interface RealOddsRecord {
  match_id: string;
  league: string;
  season: string;
  match_date: string;
  bookmaker: string;
  market: RealMarket;
  odds_type: RealOddsType;
  line: number | null;
  selection: string;
  odds: number;
  source_type: 'REAL_PROVIDER';
  provider: 'football-data.co.uk';
  source_file: string;
}

export interface RealOddsPair {
  match_id: string;
  league: string;
  season: string;
  match_date: string;
  bookmaker: string;
  market: RealMarket;
  line: number | null;
  selection: string;
  entry: RealOddsRecord | null;
  closing: RealOddsRecord | null;
}

function canonicalId(seasonFull: string, date: string, home: string, away: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // existing normalized dataset uses full-season form EPL-2022-2023-2022-08-05-...
  return `EPL-${seasonFull}-${date}-${slug(home)}-${slug(away)}`;
}

function parseDate(d: string): string {
  // football-data.co.uk dates are DD/MM/YYYY
  const [dd, mm, yyyy] = d.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
}

function seasonOf(dateStr: string): string {
  const year = parseInt(dateStr.slice(0, 4), 10);
  return `${year}-${String(year + 1).slice(2)}`;
}

export function extractRealOddsFromCsv(csvPath: string): RealOddsRecord[] {
  const records: RealOddsRecord[] = [];
  const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return records;
  const header = lines[0].split(',');
  const idx: Record<string, number> = {};
  header.forEach((h, i) => { idx[h] = i; });

  const need = ['PSH', 'PSD', 'PSA', 'PSCH', 'PSCD', 'PSCA', 'P>2.5', 'P<2.5', 'PC>2.5', 'PC<2.5', 'AHh', 'PAHH', 'PAHA', 'AHCh', 'PCAHH', 'PCAHA'];
  if (!need.every((c) => idx[c] !== undefined)) return records;

  const div = (lines[1].split(','))[0] || 'E0';

  for (const line of lines.slice(1)) {
    const c = line.split(',');
    const get = (name: string): number | null => {
      const i = idx[name];
      return i !== undefined ? num(c[i]) : null;
    };
    const dateRaw = c[idx['Date']];
    if (!dateRaw) continue;
    const date = parseDate(dateRaw);
    const home = c[idx['HomeTeam']]?.trim();
    const away = c[idx['AwayTeam']]?.trim();
    if (!home || !away) continue;
    const seasonShort = seasonOf(date);
    const seasonFull = `${seasonShort.slice(0, 4)}-${parseInt(seasonShort.slice(0, 4), 10) + 1}`;
    const mid = canonicalId(seasonFull, date, home, away);

    const push = (market: RealMarket, oddsType: RealOddsType, line: number | null, selection: string, odds: number | null, sourceFile: string) => {
      if (odds !== null && odds > 1.0 && isFinite(odds)) {
        records.push({
          match_id: mid,
          league: div,
          season: seasonFull,
          match_date: date,
          bookmaker: 'pinnacle',
          market,
          odds_type: oddsType,
          line,
          selection,
          odds,
          source_type: 'REAL_PROVIDER',
          provider: 'football-data.co.uk',
          source_file: sourceFile,
        });
      }
    };

    // 1X2
    const h1 = get('PSH'), d1 = get('PSD'), a1 = get('PSA');
    push('ML', 'entry', null, 'home', h1, csvPath);
    push('ML', 'entry', null, 'draw', d1, csvPath);
    push('ML', 'entry', null, 'away', a1, csvPath);
    const h1c = get('PSCH'), d1c = get('PSCD'), a1c = get('PSCA');
    push('ML', 'closing', null, 'home', h1c, csvPath);
    push('ML', 'closing', null, 'draw', d1c, csvPath);
    push('ML', 'closing', null, 'away', a1c, csvPath);

    // OU 2.5
    const ov = get('P>2.5'), un = get('P<2.5');
    push('OU25', 'entry', 2.5, 'over', ov, csvPath);
    push('OU25', 'entry', 2.5, 'under', un, csvPath);
    const ovc = get('PC>2.5'), unc = get('PC<2.5');
    push('OU25', 'closing', 2.5, 'over', ovc, csvPath);
    push('OU25', 'closing', 2.5, 'under', unc, csvPath);

    // AH — handicap is from the home team perspective
    const ahh = get('AHh');
    const pahh = get('PAHH'), paha = get('PAHA');
    if (ahh !== null) {
      push('AH', 'entry', ahh, 'home', pahh, csvPath);
      push('AH', 'entry', -ahh, 'away', paha, csvPath);
    }
    const ahch = get('AHCh');
    const pahhc = get('PCAHH'), pahac = get('PCAHA');
    if (ahch !== null) {
      push('AH', 'closing', ahch, 'home', pahhc, csvPath);
      push('AH', 'closing', -ahch, 'away', pahac, csvPath);
    }
  }
  return records;
}

export function pairRealOdds(records: RealOddsRecord[]): RealOddsPair[] {
  const byKey = new Map<string, RealOddsPair>();
  for (const r of records) {
    const key = `${r.match_id}|${r.market}|${r.line ?? 'flat'}|${r.selection}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        match_id: r.match_id,
        league: r.league,
        season: r.season,
        match_date: r.match_date,
        bookmaker: r.bookmaker,
        market: r.market,
        line: r.line,
        selection: r.selection,
        entry: null,
        closing: null,
      });
    }
    const pair = byKey.get(key)!;
    if (r.odds_type === 'entry') pair.entry = r;
    else pair.closing = r;
  }
  return [...byKey.values()];
}

export function settleRealOutcome(market: RealMarket, selection: string, line: number | null, homeGoals: number, awayGoals: number): 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS' {
  if (market === 'ML') {
    const actual = homeGoals > awayGoals ? 'home' : homeGoals < awayGoals ? 'away' : 'draw';
    return actual === selection ? 'WIN' : 'LOSS';
  }
  if (market === 'OU25') {
    return settleAsianTotal(selection as 'over' | 'under', line ?? 2.5, homeGoals + awayGoals);
  }
  if (market === 'AH') {
    return settleAsianHandicap(selection as 'home' | 'away', line ?? 0, homeGoals, awayGoals);
  }
  throw new Error(`Unknown market ${market}`);
}

export function profitOfOutcome(outcome: 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS', decimalOdds: number, stake = 1): number {
  switch (outcome) {
    case 'WIN': return (decimalOdds - 1) * stake;
    case 'HALF_WIN': return ((decimalOdds - 1) / 2) * stake;
    case 'PUSH': return 0;
    case 'HALF_LOSS': return -0.5 * stake;
    case 'LOSS': return -stake;
  }
}

export function buildRealOddsDataset(): { records: number; pairs: number; file: string } {
  const dir = path.resolve(process.cwd(), 'data', 'bronze', 'football_data');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv')).sort();
  let all: RealOddsRecord[] = [];
  for (const f of files) {
    all = all.concat(extractRealOddsFromCsv(path.join(dir, f)));
  }
  const pairs = pairRealOdds(all);
  fs.writeFileSync(REAL_ODDS_OUT, pairs.map((p) => JSON.stringify(p)).join('\n') + '\n');
  return { records: all.length, pairs: pairs.length, file: REAL_ODDS_OUT };
}

// main entry for CLI run: npm run historical:real-odds-ingest
if (require.main === module) {
  const r = buildRealOddsDataset();
  console.log(JSON.stringify(r, null, 2));
}
