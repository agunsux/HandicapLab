// Research Data Loader — Deterministic, Resumable, Duplicate-Safe
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface MatchRecord {
  date: Date;
  league: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  fthg: number;
  ftag: number;
  ftr: 'H' | 'D' | 'A';
  psh: number | null;
  psd: number | null;
  psa: number | null;
  psch: number | null;
  pscd: number | null;
  psca: number | null;
  rowIndex: number;
}

export interface LoadResult {
  matches: MatchRecord[];
  hashes: Record<string, string>;
  totalFiles: number;
}

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function dateFromCSV(dateStr: string): Date {
  const parts = dateStr.trim().split('/');
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  let year = parseInt(parts[2], 10);
  if (year < 100) year += 2000;
  return new Date(Date.UTC(year, month, day, 12, 0));
}

function safeParse(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(val.trim());
  return isNaN(n) || n <= 0 ? null : n;
}

export function loadLeagueData(league: string, season: string): MatchRecord[] {
  const csvPath = path.join(process.cwd(), 'data', league, `${season}.csv`);
  if (!fs.existsSync(csvPath)) return [];

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',');
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase().trim());
  const idxDate = idx('Date'), idxHome = idx('HomeTeam'), idxAway = idx('AwayTeam');
  const idxFTHG = idx('FTHG'), idxFTAG = idx('FTAG'), idxFTR = idx('FTR');
  const idxPSH = idx('PSH') >= 0 ? idx('PSH') : idx('B365H');
  const idxPSD = idx('PSD') >= 0 ? idx('PSD') : idx('B365D');
  const idxPSA = idx('PSA') >= 0 ? idx('PSA') : idx('B365A');
  const idxPSCH = idx('PSCH') >= 0 ? idx('PSCH') : idx('B365CH');
  const idxPSCD = idx('PSCD') >= 0 ? idx('PSCD') : idx('B365CD');
  const idxPSCA = idx('PSCA') >= 0 ? idx('PSCA') : idx('B365CA');

  const matches: MatchRecord[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c.length < 10) continue;
    const date = dateFromCSV(c[idxDate]);
    const homeTeam = (c[idxHome] || '').trim();
    const awayTeam = (c[idxAway] || '').trim();
    if (!homeTeam || !awayTeam) continue;
    const fthg = parseInt(c[idxFTHG], 10);
    const ftag = parseInt(c[idxFTAG], 10);
    const ftr = (c[idxFTR] || '').trim() as 'H' | 'D' | 'A';
    if (!['H', 'D', 'A'].includes(ftr)) continue;
    const psch = safeParse(c[idxPSCH]);
    const pscd = safeParse(c[idxPSCD]);
    const psca = safeParse(c[idxPSCA]);
    if (psch === null || pscd === null || psca === null) continue;
    const psh = safeParse(c[idxPSH]) || psch;
    const psd = safeParse(c[idxPSD]) || pscd;
    const psa = safeParse(c[idxPSA]) || psca;
    const key = `${date.toISOString()}_${homeTeam}_${awayTeam}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({ date, league, season, homeTeam, awayTeam, fthg, ftag, ftr, psh, psd, psa, psch, pscd, psca, rowIndex: i });
  }

  matches.sort((a, b) => a.date.getTime() - b.date.getTime());
  return matches;
}

export function loadAllData(leagues: string[], seasons: string[]): LoadResult {
  const allMatches: MatchRecord[] = [];
  const hashes: Record<string, string> = {};
  let totalFiles = 0;

  for (const league of leagues) {
    for (const season of seasons) {
      const csvPath = path.join(process.cwd(), 'data', league, `${season}.csv`);
      if (fs.existsSync(csvPath)) {
        hashes[`${league}/${season}`] = sha256(csvPath);
        const matches = loadLeagueData(league, season);
        allMatches.push(...matches);
        totalFiles++;
      }
    }
  }

  allMatches.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { matches: allMatches, hashes, totalFiles };
}
