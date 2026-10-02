// ============================================================================
// RESEARCH PATH ISOLATION — football-data.co.uk evidence layer
// ============================================================================
// Location: src/research/football-data/researchPaths.ts
//
// RESEARCH-ONLY. Nothing under `data/research/**` is ever read by the app at
// runtime and nothing here is ever written into `data/golden/europe/**`.
//
// WHY THIS FILE EXISTS (audit finding D1):
//   `buildHistoricalDataset()` (src/historical/europe/ingest.ts) and
//   `buildMarketOddsDataset()` (src/historical/europe/marketOdds.ts) historically
//   wrote unconditionally into `data/golden/europe/`, which is the directory
//   loaded into the production Supabase gold tables. Running the test suite
//   therefore mutated production-loaded artifacts. The research layer must never
//   be able to repeat that, so every write goes through `assertResearchSafePath`.
// ============================================================================

import * as path from 'path';

/** Production-loaded gold directory — writing here is FORBIDDEN from research. */
export const PRODUCTION_GOLD_DIR = path.join(process.cwd(), 'data', 'golden', 'europe');

/** Isolated root for every research artifact produced by this namespace. */
export const RESEARCH_ROOT = path.join(process.cwd(), 'data', 'research', 'football_data');

/** Raw bronze roots that research may READ (never write). */
export const BRONZE_MAIN_DIR = path.join(process.cwd(), 'data', 'bronze', 'football_data');
export const BRONZE_QUANT_DIR = path.join(
  process.cwd(),
  'research',
  'quant',
  'data',
  'bronze',
  'football_data_co_uk'
);

const REL = (p: string) => path.relative(process.cwd(), p).split(path.sep).join('/');

/**
 * Fail-closed guard. Throws unless `target` resolves to a path strictly inside
 * the isolated research root. This is the single chokepoint that makes it
 * impossible for research code to mutate production-loaded gold artifacts.
 */
export function assertResearchSafePath(target: string): string {
  const resolved = path.resolve(target);
  const researchRoot = path.resolve(RESEARCH_ROOT);

  const insideResearch =
    resolved === researchRoot || resolved.startsWith(researchRoot + path.sep);

  if (!insideResearch) {
    throw new Error(
      `[research-isolation] Refusing to write outside the research root.\n` +
        `  target       : ${REL(resolved)}\n` +
        `  research root: ${REL(researchRoot)}\n` +
        `  production   : ${REL(PRODUCTION_GOLD_DIR)} (FORBIDDEN)\n` +
        `Research artifacts must never touch production-loaded gold paths.`
    );
  }
  return resolved;
}

/** Resolve (and guard) an output directory under the research root. */
export function researchDir(...segments: string[]): string {
  return assertResearchSafePath(path.join(RESEARCH_ROOT, ...segments));
}

/** Resolve (and guard) a single artifact file under the research root. */
export function researchFile(name: string, ...dirSegments: string[]): string {
  return assertResearchSafePath(path.join(RESEARCH_ROOT, ...dirSegments, name));
}

/** True when `p` is inside the production gold directory. */
export function isProductionGoldPath(p: string): boolean {
  const resolved = path.resolve(p);
  const gold = path.resolve(PRODUCTION_GOLD_DIR);
  return resolved === gold || resolved.startsWith(gold + path.sep);
}

/** Relative-to-repo display path, used in reports. */
export function repoRelative(p: string): string {
  return REL(path.resolve(p));
}
