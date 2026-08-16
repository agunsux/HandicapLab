// football-data.co.uk CSV reader. Schema varies across seasons (61→106+
// columns) and file generations (BOM present in newer downloads, dd/mm/yyyy vs
// dd/mm/yy dates, and BetBrain aggregate odds columns on older exports).
// The reader is column-tolerant: every odds field is optional and missing/blank
// values become null — never invented.
// Location: src/historical/europe/footballDataReader.ts

import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

export interface RawFootballDataRow {
  div: string;
  season: string;
  sourceFile: string;
  sourceRow: number;
  dateIso: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  ftr: string | null;
  bookmakerSource: 'pinnacle' | 'bet365' | 'betbrain' | 'mixed' | 'none';
  h1: number | null;
  d1: number | null;
  a1: number | null;
  ch1: number | null;
  cd1: number | null;
  ca1: number | null;
  ahLine: number | null;
  ahHome: number | null;
  ahAway: number | null;
  chLine: number | null;
  chHome: number | null;
  chAway: number | null;
  ouLine: number | null;
  over: number | null;
  under: number | null;
  couLine: number | null;
  cover: number | null;
  cunder: number | null;
  // ─── Per-bookmaker raw values (preserved verbatim for market-observation rows) ───
  // Bet365 Moneyline (open + closing)
  b365H: number | null;
  b365D: number | null;
  b365A: number | null;
  b365CH: number | null;
  b365CD: number | null;
  b365CA: number | null;
  // Bet365 Asian Handicap (open + closing; line shared with AHh/AHCh)
  b365AhHome: number | null;
  b365AhAway: number | null;
  b365AhCloseHome: number | null;
  b365AhCloseAway: number | null;
  // BetBrain Asian Handicap (open; own line BbAHh)
  bbAhLine: number | null;
  bbAhHome: number | null;
  bbAhAway: number | null;
  // Bet365 Over/Under 2.5 (open + closing)
  b365Over: number | null;
  b365Under: number | null;
  b365Cover: number | null;
  b365Cunder: number | null;
  // BetBrain Over/Under 2.5 (open)
  bbOver: number | null;
  bbUnder: number | null;
}

export interface ReadFileResult {
  rows: RawFootballDataRow[];
  parseError: string | null;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** dd/mm/yyyy, dd/mm/yy, yyyy-mm-dd. Returns null when unparseable. */
function toDateIso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const day = Number(dd);
    const month = Number(mm);
    const year = Number(yyyy);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const dmy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (dmy2) {
    const [, dd, mm, yy] = dmy2;
    const day = Number(dd);
    const month = Number(mm);
    const year = 2000 + Number(yy);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null;
    return `${y}-${m}-${d}`;
  }

  return null;
}

/** Normalize a season key like '2020-2021' or '2021/22' → '2020-2021' (or null). */
export function normalizeSeasonKey(season: string | null): string | null {
  if (!season) return null;
  const m = season.trim().match(/^(\d{4})[-/](\d{2,4})$/);
  if (!m) return null;
  const start = Number(m[1]);
  let end = Number(m[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end < 100) end += 2000;
  if (end !== start + 1) return null;
  return `${start}-${end}`;
}

export function readFootballDataCsv(filePath: string, seasonKey: string): ReadFileResult {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    return { rows: [], parseError: err?.message || String(err) };
  }

  let records: any[];
  try {
    // bom:true strips a UTF-8 BOM on the first header cell (newer downloads).
    records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true });
  } catch (err: any) {
    return { rows: [], parseError: err?.message || String(err) };
  }

  const season = normalizeSeasonKey(seasonKey);

  const rows: RawFootballDataRow[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i] ?? {};
    const homeTeam = typeof r.HomeTeam === 'string' && r.HomeTeam.trim() ? r.HomeTeam.trim() : null;
    const awayTeam = typeof r.AwayTeam === 'string' && r.AwayTeam.trim() ? r.AwayTeam.trim() : null;

    // ─── Moneyline (open/closing): Pinnacle → Bet365 → none ───
    const ml = hasAnyL(r, ['PSH', 'PSD', 'PSA'])
      ? { h: toNum(r.PSH), d: toNum(r.PSD), a: toNum(r.PSA) }
      : hasAnyL(r, ['B365H', 'B365D', 'B365A'])
        ? { h: toNum(r.B365H), d: toNum(r.B365D), a: toNum(r.B365A) }
        : { h: null, d: null, a: null };
    const cl = hasAnyL(r, ['PSCH', 'PSCD', 'PSCA'])
      ? { h: toNum(r.PSCH), d: toNum(r.PSCD), a: toNum(r.PSCA) }
      : hasAnyL(r, ['B365CH', 'B365CD', 'B365CA'])
        ? { h: toNum(r.B365CH), d: toNum(r.B365CD), a: toNum(r.B365CA) }
        : { h: null, d: null, a: null };

    // ─── Asian Handicap (open): AHh+PAHH/PAHA → B365AHH/AHA → BetBrain ───
    const ahOpen = hasAnyL(r, ['AHh', 'PAHH', 'PAHA'])
      ? {
          line: toNum(r.AHh),
          home: toNum(r.PAHH) ?? toNum(r.B365AHH),
          away: toNum(r.PAHA) ?? toNum(r.B365AHA),
        }
      : hasAnyL(r, ['BbAHh', 'BbAvAHH', 'BbAvAHA'])
        ? { line: toNum(r.BbAHh), home: toNum(r.BbAvAHH) ?? toNum(r.BbMxAHH), away: toNum(r.BbAvAHA) ?? toNum(r.BbMxAHA) }
        : { line: null, home: null, away: null };
    const ahClose = hasAnyL(r, ['AHCh', 'PCAHH', 'PCAHA'])
      ? {
          line: toNum(r.AHCh),
          home: toNum(r.PCAHH) ?? toNum(r.B365CAHH),
          away: toNum(r.PCAHA) ?? toNum(r.B365CAHA),
        }
      : { line: null, home: null, away: null };

    // ─── Over/Under 2.5 (open): P>2.5 → B365>2.5 → BetBrain average ───
    const ouOpen = hasAnyL(r, ['P>2.5', 'P<2.5'])
      ? { over: toNum(r['P>2.5']), under: toNum(r['P<2.5']) }
      : hasAnyL(r, ['B365>2.5', 'B365<2.5'])
        ? { over: toNum(r['B365>2.5']), under: toNum(r['B365<2.5']) }
        : hasAnyL(r, ['BbAv>2.5', 'BbAv<2.5'])
          ? { over: toNum(r['BbAv>2.5']), under: toNum(r['BbAv<2.5']) }
          : { over: null, under: null };
    const hasOuOpen = ouOpen.over !== null || ouOpen.under !== null;

    // ─── Over/Under 2.5 (closing): PC>2.5 → B365C>2.5 ───
    const ouClose = hasAnyL(r, ['PC>2.5', 'PC<2.5'])
      ? { over: toNum(r['PC>2.5']), under: toNum(r['PC<2.5']) }
      : hasAnyL(r, ['B365C>2.5', 'B365C<2.5'])
        ? { over: toNum(r['B365C>2.5']), under: toNum(r['B365C<2.5']) }
        : { over: null, under: null };
    const hasOuClose = ouClose.over !== null || ouClose.under !== null;

    // ─── Source label: pin the bookmaker family actually used ───
    const anyPin = hasAnyL(r, ['PSH', 'PSD', 'PSA', 'PSCH', 'PSCD', 'PSCA', 'PAHH', 'PAHA', 'P>2.5', 'P<2.5']);
    const anyB365 = hasAnyL(r, ['B365H', 'B365D', 'B365A', 'B365CH', 'B365CD', 'B365CA', 'B365AHH', 'B365AHA', 'B365>2.5', 'B365<2.5']);
    const anyBb = hasAnyL(r, ['BbAvAHH', 'BbAvAHA', 'BbAv>2.5', 'BbAv<2.5']);
    const bookmakerSource = anyPin ? 'pinnacle' : anyB365 ? 'bet365' : anyBb ? 'betbrain' : 'none';

    rows.push({
      div: typeof r.Div === 'string' ? r.Div.trim() : '',
      season: season ?? 'unknown',
      sourceFile: filePath,
      sourceRow: i + 2,
      dateIso: toDateIso(r.Date),
      homeTeam,
      awayTeam,
      homeGoals: toNum(r.FTHG),
      awayGoals: toNum(r.FTAG),
      ftr: typeof r.FTR === 'string' && /^[HDA]$/i.test(r.FTR.trim()) ? r.FTR.trim().toUpperCase() : null,
      bookmakerSource,
      h1: ml.h, d1: ml.d, a1: ml.a,
      ch1: cl.h, cd1: cl.d, ca1: cl.a,
      ahLine: ahOpen.line,
      ahHome: ahOpen.home,
      ahAway: ahOpen.away,
      chLine: ahClose.line,
      chHome: ahClose.home,
      chAway: ahClose.away,
      ouLine: hasOuOpen ? 2.5 : null,
      over: ouOpen.over,
      under: ouOpen.under,
      couLine: hasOuClose ? 2.5 : null,
      cover: ouClose.over,
      cunder: ouClose.under,
      b365H: toNum(r.B365H), b365D: toNum(r.B365D), b365A: toNum(r.B365A),
      b365CH: toNum(r.B365CH), b365CD: toNum(r.B365CD), b365CA: toNum(r.B365CA),
      b365AhHome: toNum(r.B365AHH), b365AhAway: toNum(r.B365AHA),
      b365AhCloseHome: toNum(r.B365CAHH), b365AhCloseAway: toNum(r.B365CAHA),
      bbAhLine: toNum(r.BbAHh), bbAhHome: toNum(r.BbAvAHH), bbAhAway: toNum(r.BbAvAHA),
      b365Over: toNum(r['B365>2.5']), b365Under: toNum(r['B365<2.5']),
      b365Cover: toNum(r['B365C>2.5']), b365Cunder: toNum(r['B365C<2.5']),
      bbOver: toNum(r['BbAv>2.5']), bbUnder: toNum(r['BbAv<2.5']),
    });
  }

  return { rows, parseError: null };
}

function hasAnyL(rec: any, keys: string[]): boolean {
  for (const k of keys) {
    if (toNum(rec?.[k]) !== null) return true;
  }
  return false;
}
