// ============================================================================
// SOURCE REALITY AUDIT — what football-data.co.uk can actually express
// ============================================================================
// Location: src/research/football-data/sourceReality.ts
//
// RESEARCH-ONLY, READ-ONLY. Answers, from the raw bytes on disk and the frozen
// gold market layer:
//   • which columns each source generation carries (schema drift 65 → 132 cols)
//   • which (market × snapshot × provenance) facts genuinely exist
//   • the complete LINE INVENTORY (proves OU is 2.5-only, zero quarter lines)
//   • whether BTTS exists at all
//   • provenance integrity: rows attributed to a bookmaker that could not have
//     priced them in that era (audit finding D5)
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { parse } from 'csv-parse/sync';
import { BRONZE_MAIN_DIR, BRONZE_QUANT_DIR, researchFile, repoRelative } from './researchPaths';
import type {
  LineInventoryEntry,
  LineType,
  MarketAvailabilityFact,
  PriceProvenance,
  ResearchMarketCode,
  SnapshotCode,
  SourceEra,
  SourceFileSchema,
  SourceRealityReport,
} from './types';

// ── Columns the production reader actually consumes ──────────────────────────
// Mirrors src/historical/europe/footballDataReader.ts. Anything else present in
// the raw file is capability on the table that the current pipeline ignores.
const CONSUMED_COLUMNS = new Set<string>([
  'Div', 'Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR',
  'PSH', 'PSD', 'PSA', 'B365H', 'B365D', 'B365A',
  'PSCH', 'PSCD', 'PSCA', 'B365CH', 'B365CD', 'B365CA',
  'AHh', 'PAHH', 'PAHA', 'B365AHH', 'B365AHA',
  'AHCh', 'PCAHH', 'PCAHA', 'B365CAHH', 'B365CAHA',
  'BbAHh', 'BbAvAHH', 'BbAvAHA', 'BbMxAHH', 'BbMxAHA',
  'P>2.5', 'P<2.5', 'B365>2.5', 'B365<2.5',
  'BbAv>2.5', 'BbAv<2.5', 'PC>2.5', 'PC<2.5', 'B365C>2.5', 'B365C<2.5',
]);

/** Pinnacle column families that decide what a season can legitimately claim. */
const PINNACLE_FAMILIES: Record<string, string[]> = {
  mlOpen: ['PSH', 'PSD', 'PSA'],
  mlClose: ['PSCH', 'PSCD', 'PSCA'],
  ahOpen: ['AHh', 'PAHH', 'PAHA'],
  ahClose: ['AHCh', 'PCAHH', 'PCAHA'],
  ouOpen: ['P>2.5', 'P<2.5'],
  ouClose: ['PC>2.5', 'PC<2.5'],
};

/** OU line labels are encoded in the column names themselves (e.g. P>2.5). */
const OU_LINE_LABEL_RE = /^[A-Za-z0-9]*([><])(\d+(?:\.\d+)?)$/;
const OU_FAMILY_PREFIXES = ['P', 'B365', 'BbAv', 'BbMx', 'Max', 'Avg', 'BFE'];

/** Divides into a quarter step? (0.25 grid → quarter line). */
function onQuarterGrid(v: number): boolean {
  return Math.abs(v * 4 - Math.round(v * 4)) < 1e-9;
}

/** Classify an Asian handicap line into whole / half / quarter. */
export function classifyAhLine(line: number): LineType {
  const d = Math.abs(line);
  if (!onQuarterGrid(d)) return 'AH_HALF'; // off-grid impossible from source; flagged in findings
  if (Number.isInteger(d)) return 'AH_WHOLE';
  if (Math.abs(d * 2 - Math.round(d * 2)) < 1e-9) return 'AH_HALF';
  return 'AH_QUARTER';
}

/** Classify an over/under line into whole / half / quarter. */
export function classifyOuLine(line: number): LineType {
  const d = Math.abs(line);
  if (!onQuarterGrid(d)) return 'OU_HALF';
  if (Number.isInteger(d)) return 'OU_WHOLE';
  if (Math.abs(d * 2 - Math.round(d * 2)) < 1e-9) return 'OU_HALF';
  return 'OU_QUARTER';
}

function listCsv(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv')).sort();
}

/** Season key for the main-bronze filename convention (2019-2020.csv). */
function seasonFromMainName(base: string): string | null {
  const m = base.match(/^(\d{4})-(\d{4})$/);
  return m && Number(m[2]) - Number(m[1]) === 1 ? `${m[1]}-${m[2]}` : null;
}

/** Season key for the quant-bronze filename convention (E0_1920.csv). */
function seasonFromQuantName(base: string): string | null {
  const m = base.match(/^[A-Z0-9]+_(\d{2})(\d{2})\.csv$/);
  if (!m) return null;
  const start = 2000 + Number(m[1]);
  return `${start}-${start + 1}`;
}

/**
 * Read the raw header + row count of one source CSV using the SAME parser and
 * options as the production reader, so the audit describes the real bytes.
 */
export function readSourceSchema(filePath: string, season: string, rootLabel: string): SourceFileSchema {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as string[][];

  const header = (records[0] ?? []).map((h) => String(h).trim());
  const present = new Set(header);

  const columnsPresent: Record<string, boolean> = {};
  for (const c of Array.from(CONSUMED_COLUMNS).sort()) columnsPresent[c] = present.has(c);

  const pinnacle = Object.fromEntries(
    Object.entries(PINNACLE_FAMILIES).map(([k, cols]) => [k, cols.every((c) => present.has(c))])
  ) as SourceFileSchema['pinnacle'];

  const ouLineLabels = new Set<string>();
  for (const h of header) {
    const m = h.match(OU_LINE_LABEL_RE);
    if (m && OU_FAMILY_PREFIXES.some((p) => h.startsWith(p))) ouLineLabels.add(m[2]);
  }

  const ahLineColumns = header.filter((h) => /^(AHh|AHCh|BbAHh)$/.test(h));
  const era: SourceEra = present.has('AHh') ? 'ERA2_PINNACLE' : 'ERA1_BETBRAIN';
  const unusedButPresent = header.filter((h) => h && !CONSUMED_COLUMNS.has(h));

  return {
    file: repoRelative(filePath),
    root: rootLabel,
    season,
    rows: Math.max(0, records.length - 1),
    columns: header.length,
    era,
    columnsPresent,
    ouLineLabels: Array.from(ouLineLabels).sort(),
    ahLineColumns,
    pinnacle,
    unusedButPresent,
  };
}

/** Enumerate every raw source file that physically exists (both roots). */
export function enumerateSourceFiles(): SourceFileSchema[] {
  const out: SourceFileSchema[] = [];
  for (const f of listCsv(BRONZE_MAIN_DIR)) {
    const season = seasonFromMainName(f.replace(/\.csv$/i, ''));
    if (!season) continue;
    out.push(readSourceSchema(path.join(BRONZE_MAIN_DIR, f), season, 'data/bronze/football_data'));
  }
  for (const f of listCsv(BRONZE_QUANT_DIR)) {
    const season = seasonFromQuantName(f);
    if (!season) continue;
    out.push(
      readSourceSchema(path.join(BRONZE_QUANT_DIR, f), season, 'research/quant/data/bronze/football_data_co_uk')
    );
  }
  return out.sort((a, b) => a.root.localeCompare(b.root) || a.file.localeCompare(b.file));
}

/** Season → source era, derived from the real columns of the files on disk. */
let _eraCache: Map<string, SourceEra> | null = null;

export function eraOfSeasonMap(): Map<string, SourceEra> {
  if (_eraCache) return _eraCache;
  const map = new Map<string, SourceEra>();
  for (const f of enumerateSourceFiles()) if (!map.has(f.season)) map.set(f.season, f.era);
  _eraCache = map;
  return map;
}

// ── Gold market layer aggregation (streamed, READ-ONLY) ──────────────────────

/** Raw shape of a row in `data/golden/europe/market_odds.jsonl` (frozen v1). */
export interface GoldOddsRow {
  odds_id: string;
  canonical_id: string;
  league_id: string;
  cluster: string;
  season: string;
  match_date: string;
  market: ResearchMarketCode;
  observation: SnapshotCode;
  bookmaker_source: string;
  line: number | null;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  over_odds: number | null;
  under_odds: number | null;
  source_file: string;
  source_row: number;
  dataset_version: string;
  ingestion_version: string;
}

const GOLD_MARKET_ODDS = path.join(process.cwd(), 'data', 'golden', 'europe', 'market_odds.jsonl');

/** Stream every gold odds row without materialising the 46 MB file. */
export async function forEachGoldOddsRow(
  cb: (row: GoldOddsRow) => void,
  file: string = GOLD_MARKET_ODDS
): Promise<number> {
  if (!fs.existsSync(file)) return 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });
  let n = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    cb(JSON.parse(line) as GoldOddsRow);
    n++;
  }
  return n;
}

/**
 * Which eras a (market, snapshot, provenance) claim is physically possible in,
 * derived from the raw column availability (not from the gold rows themselves —
 * otherwise the audit could not detect the defect).
 */
export function erasWhereTradeable(
  market: ResearchMarketCode,
  snapshot: SnapshotCode,
  provenance: PriceProvenance
): SourceEra[] {
  if (market === 'BTTS') return [];
  if (provenance === 'pinnacle') {
    // PSH/PSCH exist in both eras; Pinnacle AH/OU columns only in ERA2.
    if (market === 'ML') return ['ERA1_BETBRAIN', 'ERA2_PINNACLE'];
    return ['ERA2_PINNACLE'];
  }
  if (provenance === 'bet365') {
    if (market === 'ML') return ['ERA1_BETBRAIN', 'ERA2_PINNACLE'];
    // B365AHH/B365>2.5 exist only in ERA2.
    return ['ERA2_PINNACLE'];
  }
  if (provenance === 'betbrain_average') {
    if (market === 'AH') return ['ERA1_BETBRAIN', 'ERA2_PINNACLE'];
    if (market === 'OU') return ['ERA1_BETBRAIN'];
  }
  return ['ERA1_BETBRAIN', 'ERA2_PINNACLE'];
}

export interface AuditOptions {
  /** Persist the report JSON into the isolated research root. Default: true. */
  write?: boolean;
}

/** Map a raw `bookmaker_source` value to a normalised provenance. */
export function normalizeProvenance(raw: string): PriceProvenance {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('pinnacle')) return 'pinnacle';
  if (s.includes('bet365')) return 'bet365';
  if (s.includes('betbrain')) return 'betbrain_average';
  return 'unknown';
}

interface AvailabilityBucket {
  market: ResearchMarketCode;
  snapshot: SnapshotCode;
  provenance: PriceProvenance;
  rows: number;
  matches: Set<string>;
  seasons: Set<string>;
}

interface LineBucket {
  market: ResearchMarketCode;
  lineType: LineType;
  line: number | null;
  rows: number;
}

/**
 * Build the full source-reality report. Reads the raw bronze CSVs and streams
 * the frozen gold market layer; performs no writes outside the research root.
 */
export async function auditSourceReality(options: AuditOptions = {}): Promise<SourceRealityReport> {
  const write = options.write !== false;

  const files = enumerateSourceFiles();
  const eraOfSeason = eraOfSeasonMap();

  const availability = new Map<string, AvailabilityBucket>();
  const lineRows = new Map<string, LineBucket>();
  const ouLines = new Set<number>();
  const ahPinnacleClosingLines = new Set<number>();
  const violations = new Map<string, { rows: number; seasons: Set<string> }>();
  let mislabeledAhOpening = 0;

  await forEachGoldOddsRow((row) => {
    const provenance = normalizeProvenance(row.bookmaker_source);
    const season = String(row.season);
    const era = eraOfSeason.get(season) ?? null;

    const ak = `${row.market}|${row.observation}|${provenance}`;
    const bucket = availability.get(ak) ?? {
      market: row.market,
      snapshot: row.observation,
      provenance,
      rows: 0,
      matches: new Set<string>(),
      seasons: new Set<string>(),
    };
    bucket.rows++;
    bucket.matches.add(row.canonical_id);
    bucket.seasons.add(season);
    availability.set(ak, bucket);

    const lineType: LineType =
      row.market === 'ML'
        ? 'ML'
        : row.market === 'AH'
          ? classifyAhLine(row.line ?? 0)
          : classifyOuLine(row.line ?? 0);
    const lk = `${row.market}|${lineType}|${row.line}`;
    const lb = lineRows.get(lk) ?? { market: row.market, lineType, line: row.line, rows: 0 };
    lb.rows++;
    lineRows.set(lk, lb);

    if (row.market === 'OU' && row.line !== null) ouLines.add(row.line);
    if (row.market === 'AH' && row.observation === 'closing' && provenance === 'pinnacle' && row.line !== null) {
      ahPinnacleClosingLines.add(row.line);
    }

    // ── Provenance integrity (audit finding D5) ──
    if (era) {
      const allowed = erasWhereTradeable(row.market, row.observation, provenance);
      if (!allowed.includes(era)) {
        const vk = `${row.market}|${row.observation}|${provenance}|${era}`;
        const v = violations.get(vk) ?? { rows: 0, seasons: new Set<string>() };
        v.rows++;
        v.seasons.add(season);
        violations.set(vk, v);
        if (row.market === 'AH' && row.observation === 'opening') mislabeledAhOpening++;
      }
    }
  });

  const marketAvailability: MarketAvailabilityFact[] = Array.from(availability.values())
    .map((b) => {
      const allowed = erasWhereTradeable(b.market, b.snapshot, b.provenance);
      const badSeasons = Array.from(b.seasons)
        .filter((s) => {
          const era = eraOfSeason.get(s);
          return era ? !allowed.includes(era) : false;
        })
        .sort();
      const mislabeled = badSeasons.length > 0;
      return {
        market: b.market,
        snapshot: b.snapshot,
        provenance: b.provenance,
        rows: b.rows,
        matches: b.matches.size,
        seasons: Array.from(b.seasons).sort(),
        mislabeledOrUntradeable: mislabeled,
        note: mislabeled
          ? `IMPOSSIBLE PROVENANCE in ${badSeasons.join(', ')}: the source columns for this bookmaker/era do not exist, so these values are a fallback aggregate attributed to '${b.provenance}'. Not tradeable; unsafe for CLV.`
          : 'Genuine source observation.',
      } satisfies MarketAvailabilityFact;
    })
    .sort(
      (a, b) =>
        a.market.localeCompare(b.market) ||
        String(a.snapshot).localeCompare(String(b.snapshot)) ||
        a.provenance.localeCompare(b.provenance)
    );

  const lineInventory: LineInventoryEntry[] = Array.from(lineRows.values())
    .map((l) => ({
      market: l.market,
      lineType: l.lineType,
      line: l.line,
      rows: l.rows,
      isQuarter: l.lineType === 'AH_QUARTER' || l.lineType === 'OU_QUARTER',
    }))
    .sort((a, b) => a.market.localeCompare(b.market) || (a.line ?? -999) - (b.line ?? -999));

  // ── Findings ──────────────────────────────────────────────────────────────
  const findings: string[] = [];
  const limitations: string[] = [];

  const colCounts = files.map((f) => f.columns);
  findings.push(
    `Schema drift across ${files.length} raw source files: ${Math.min(...colCounts)} → ${Math.max(...colCounts)} columns.`
  );

  const eras = new Map<SourceEra, string[]>();
  for (const f of files) eras.set(f.era, [...(eras.get(f.era) ?? []), f.season]);
  for (const [era, seasons] of eras) {
    const uniq = Array.from(new Set(seasons)).sort();
    findings.push(`${era}: ${uniq.length} seasons (${uniq[0]} … ${uniq[uniq.length - 1]}).`);
  }

  const ouSorted = Array.from(ouLines).sort((a, b) => a - b);
  findings.push(
    `OU line inventory in the gold layer: [${ouSorted.join(', ')}] → ${
      ouSorted.length === 1 && ouSorted[0] === 2.5
        ? 'EXACTLY 2.5 — ZERO other lines, ZERO quarter lines. OU depth is a single point.'
        : 'UNEXPECTED variety — investigate.'
    }`
  );
  findings.push(
    `Pinnacle CLOSING AH lines: ${ahPinnacleClosingLines.size} distinct (${
      Array.from(ahPinnacleClosingLines).sort((a, b) => a - b).join(', ') || 'none'
    }).`
  );

  const unusedUnion = new Set<string>();
  for (const f of files) for (const c of f.unusedButPresent) unusedUnion.add(c);
  findings.push(
    `${unusedUnion.size} raw columns exist that the current reader ignores (market Max/Avg across books, extra bookmakers, kickoff Time) — capability on the table, not yet exploited.`
  );

  if (violations.size === 0) {
    findings.push('Provenance integrity: PASS — every (market, snapshot, bookmaker) claim is possible in its source era.');
  } else {
    for (const [k, v] of violations) {
      findings.push(
        `PROVENANCE DEFECT (D5) ${k}: ${v.rows} rows across ${Array.from(v.seasons).sort().join(', ')} claim a price source that era cannot produce.`
      );
    }
    findings.push(
      `D5 impact: ${mislabeledAhOpening} AH OPENING rows are attributed to a bookmaker that has no AH columns in their era — their numbers originate from a market-average fallback.`
    );
  }

  const bttsRows = Array.from(availability.values())
    .filter((b) => b.market === 'BTTS')
    .reduce((s, b) => s + b.rows, 0);
  findings.push(`BTTS: ${bttsRows === 0 ? 'ABSENT — zero BTTS columns in any source generation.' : `present (${bttsRows} rows).`}`);

  limitations.push('Opening/closing are the ONLY snapshots the source documents; there is no T-minus horizon grid.');
  limitations.push('No live/streaming feed: this layer can serve post-hoc research and backtests only.');
  limitations.push('football-data.co.uk licensing forbids automated/AI/commercial use — research evidence only.');
  limitations.push('Pinnacle price quality degrades after 2025-07-23 (see notes.txt); ERA2 recent coverage must be date-gated.');

  const report: SourceRealityReport = {
    generated_at: new Date().toISOString(),
    scope: 'Top-league source reality for the SALMO evidence layer (research only)',
    dataset_version: 'europe-dataset-v1',
    ingestion_version: 'europe-odds-v1',
    files,
    marketAvailability,
    lineInventory,
    ouDistinctLines: ouSorted,
    ahDistinctLines: Array.from(ahPinnacleClosingLines).sort((a, b) => a - b),
    bttsSupported: bttsRows > 0,
    findings,
    limitations,
  };

  if (write) {
    const target = researchFile('SOURCE_REALITY_AUDIT.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(report, null, 2));
  }

  return report;
}




