// Source discovery. Enumerates ONLY files that physically exist in the
// repository — there is no code path that invents/downloads/synthesizes data.
// For the rich per-season main bronze exports the actual Div codes present in
// each file are inspected (cached) so a file is only claimed for a league it
// really contains. Overlapping seasons across roots are kept as candidates and
// resolved by source priority during dedup (priority: higher wins).
// Location: src/historical/europe/sourceDiscovery.ts

import * as fs from 'fs';
import * as path from 'path';

export interface SourceDescriptor {
  filePath: string;
  season: string;
  div: string;
  priority: number;
  rootLabel: string;
}

const PROJECT_ROOT = process.cwd();

const MAIN_BRONZE_DIR = path.join(PROJECT_ROOT, 'data', 'bronze', 'football_data');
const QUANT_BRONZE_DIR = path.join(PROJECT_ROOT, 'research', 'quant', 'data', 'bronze', 'football_data_co_uk');

/** Distinct Div codes present in a main-bronze file (cached, read-only). */
const mainFileDivsCache = new Map<string, Set<string>>();

function divsPresent(filePath: string): Set<string> {
  const cached = mainFileDivsCache.get(filePath);
  if (cached) return cached;
  const found = new Set<string>();
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const first = (lines[i] ?? '').split(',', 1)[0]?.trim();
      if (first) found.add(first);
    }
  } catch {
    // leave empty
  }
  mainFileDivsCache.set(filePath, found);
  return found;
}

function listCsv(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv')).sort();
}

function seasonFromMainName(base: string): string | null {
  const m = base.match(/^(\d{4})-(\d{4})$/);
  if (!m) return null;
  return Number(m[2]) - Number(m[1]) === 1 ? `${m[1]}-${m[2]}` : null;
}

function seasonFromQuantName(base: string): string | null {
  const m = base.match(/^[A-Z0-9]+_(\d{2})(\d{2})\.csv$/);
  if (!m) return null;
  const start = 2000 + Number(m[1]);
  return `${start}-${start + 1}`;
}

export interface LeagueSources {
  leagueId: string;
  div: string;
  descriptors: SourceDescriptor[];
}

export function discoverLeagueSources(leagueId: string, footballDataCode: string): LeagueSources {
  const descriptors: SourceDescriptor[] = [];

  // 1. Primary: data/bronze/football_data/*.csv — only for files that really
  //    contain this Div code (content-verified, not filename-based).
  for (const f of listCsv(MAIN_BRONZE_DIR)) {
    const season = seasonFromMainName(f.replace(/\.csv$/i, ''));
    if (!season) continue;
    const filePath = path.join(MAIN_BRONZE_DIR, f);
    if (!divsPresent(filePath).has(footballDataCode)) continue;
    descriptors.push({ filePath, season, div: footballDataCode, priority: 10, rootLabel: 'data/bronze/football_data' });
  }

  // 2. Secondary: research/quant bronze per-league files (top-5, 2016-2020).
  //    Always emitted; overlapping seasons are resolved by priority in dedup.
  for (const f of listCsv(QUANT_BRONZE_DIR)) {
    const prefix = f.split('_')[0] ?? '';
    if (prefix !== footballDataCode) continue;
    const season = seasonFromQuantName(f);
    if (!season) continue;
    descriptors.push({
      filePath: path.join(QUANT_BRONZE_DIR, f),
      season,
      div: footballDataCode,
      priority: 5,
      rootLabel: 'research/quant/data/bronze/football_data_co_uk',
    });
  }

  descriptors.sort((a, b) => a.season.localeCompare(b.season) || b.priority - a.priority);
  return { leagueId, div: footballDataCode, descriptors };
}

/** For tests/audit: clear the per-file Div cache (not needed in normal use). */
export function _clearDivCache(): void {
  mainFileDivsCache.clear();
}
