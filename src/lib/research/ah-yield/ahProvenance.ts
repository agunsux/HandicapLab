// AH YIELD ENGINE — Source-provenance resolution.
//
// The legacy `bookmaker_source` label in market_odds.jsonl is NOT reliable for
// pre-2019 sources: football-data.co.uk files from 2015-16..2018-19 contain
// only BetBrain aggregate AH columns (BbAHh / BbAvAHH / BbAvAHA), yet the
// ingestion emitted the same quote twice, labeled `pinnacle` and `betbrain`.
//
// This resolver reads the ACTUAL source CSV header and classifies which
// branch the football-data reader used for that file, so every observation
// carries its true provenance. No network access, no guesses: files that
// cannot be read resolve to 'unknown' and are excluded from bookmaker-specific
// aggregates.

import * as fs from 'fs';
import * as path from 'path';
import type { AhProvenance } from './ahTypes';

export interface AhSourceLayout {
  sourceFile: string;
  /** Which publisher the AH open branch actually came from. */
  openBranch: AhProvenance | 'none';
  /** Which publisher the AH closing branch actually came from. */
  closeBranch: AhProvenance | 'none';
  /** Whether genuine Bet365 AH open/close columns exist in the file. */
  hasB365Open: boolean;
  hasB365Close: boolean;
  /** Whether BetBrain aggregate AH columns exist in the file. */
  hasBetbrain: boolean;
}

export interface AhProvenanceResolver {
  /**
   * Resolve the true provenance for one odds row.
   * @param bookmakerLabel legacy label in market_odds.jsonl ('pinnacle'/'bet365'/'betbrain')
   */
  resolve(sourceFile: string, observation: string, bookmakerLabel: string): AhProvenance;
  /** Layout cache for the data-quality report. */
  listLayouts(): AhSourceLayout[];
}

function headerColumns(filePath: string): Set<string> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
    const clean = firstLine.replace(/^\uFEFF/, '');
    const cols = clean.split(',').map((c) => c.trim());
    return new Set(cols);
  } catch {
    return null;
  }
}

function hasAny(cols: Set<string>, keys: string[]): boolean {
  return keys.some((k) => cols.has(k));
}

/** Resolve an absolute source_file path that may have been recorded on another machine root. */
export function resolveSourceFilePath(sourceFile: string): string | null {
  if (!sourceFile) return null;
  if (fs.existsSync(sourceFile)) return sourceFile;
  const normalized = sourceFile.replace(/\\/g, '/');
  const marker = 'HandicapLab/';
  const idx = normalized.indexOf(marker);
  if (idx >= 0) {
    const rel = normalized.slice(idx + marker.length);
    const candidate = path.join(process.cwd(), ...rel.split('/'));
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Mirrors the decision tree in src/historical/europe/footballDataReader.ts:
 * - open branch: AHh/PAHH/PAHA → Pinnacle; if only AHh + B365AHH → Bet365;
 *   else BbAHh/BbAvAHH/BbAvAHA → BetBrain aggregate.
 * - close branch: AHCh/PCAHH/PCAHA → Pinnacle; else B365CAHH → Bet365.
 */
export function classifySourceLayout(sourceFile: string): AhSourceLayout {
  const resolved = resolveSourceFilePath(sourceFile);
  const cols = resolved ? headerColumns(resolved) : null;
  if (!cols) {
    return {
      sourceFile,
      openBranch: 'none',
      closeBranch: 'none',
      hasB365Open: false,
      hasB365Close: false,
      hasBetbrain: false,
    };
  }

  let openBranch: AhSourceLayout['openBranch'] = 'none';
  if (hasAny(cols, ['AHh', 'PAHH', 'PAHA'])) {
    openBranch = cols.has('PAHH') ? 'pinnacle' : 'bet365';
  } else if (hasAny(cols, ['BbAHh', 'BbAvAHH', 'BbAvAHA'])) {
    openBranch = 'betbrain_avg';
  }

  let closeBranch: AhSourceLayout['closeBranch'] = 'none';
  if (hasAny(cols, ['AHCh', 'PCAHH', 'PCAHA'])) {
    closeBranch = cols.has('PCAHH') ? 'pinnacle' : 'bet365';
  } else if (hasAny(cols, ['B365CAHH', 'B365CAHA'])) {
    closeBranch = 'bet365';
  }

  return {
    sourceFile,
    openBranch,
    closeBranch,
    hasB365Open: hasAny(cols, ['B365AHH', 'B365AHA']),
    hasB365Close: hasAny(cols, ['B365CAHH', 'B365CAHA']),
    hasBetbrain: hasAny(cols, ['BbAHh', 'BbAvAHH', 'BbAvAHA']),
  };
}

export function createProvenanceResolver(): AhProvenanceResolver {
  const cache = new Map<string, AhSourceLayout>();

  const layoutOf = (sourceFile: string): AhSourceLayout => {
    const key = sourceFile || '';
    const cached = cache.get(key);
    if (cached) return cached;
    const layout = classifySourceLayout(sourceFile);
    cache.set(key, layout);
    return layout;
  };

  return {
    resolve(sourceFile: string, observation: string, bookmakerLabel: string): AhProvenance {
      const layout = layoutOf(sourceFile);
      if (bookmakerLabel === 'bet365') {
        const exists = observation === 'closing' ? layout.hasB365Close : layout.hasB365Open;
        return exists ? 'bet365' : 'unknown';
      }
      if (bookmakerLabel === 'betbrain') {
        return layout.hasBetbrain ? 'betbrain_avg' : 'unknown';
      }
      // 'pinnacle'-labeled rows follow the reader's primary branch, which is
      // BetBrain aggregate in pre-2019 sources (the historical mislabel).
      const branch = observation === 'closing' ? layout.closeBranch : layout.openBranch;
      return branch === 'none' ? 'unknown' : branch;
    },
    listLayouts(): AhSourceLayout[] {
      return Array.from(cache.values());
    },
  };
}

/**
 * Snapshot semantics: BetBrain aggregate quotes have no open/close distinction
 * in the source. They are single observations and must never be treated as a
 * genuine opening or closing price.
 */
export function snapshotFor(provenance: AhProvenance, observation: string): 'opening' | 'closing' | 'single_quote' {
  if (provenance === 'betbrain_avg') return 'single_quote';
  return observation === 'closing' ? 'closing' : 'opening';
}
