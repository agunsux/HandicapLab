// Research isolation guard — proves research code cannot mutate the
// production-loaded gold directory (audit finding D1).
// Location: tests/research/football-data/research-isolation.test.ts

import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  PRODUCTION_GOLD_DIR,
  RESEARCH_ROOT,
  assertResearchSafePath,
  isProductionGoldPath,
  repoRelative,
  researchDir,
  researchFile,
} from '../../../src/research/football-data/researchPaths';

describe('research path isolation (finding D1)', () => {
  it('accepts paths inside the isolated research root', () => {
    expect(() => assertResearchSafePath(RESEARCH_ROOT)).not.toThrow();
    expect(() => assertResearchSafePath(path.join(RESEARCH_ROOT, 'SOURCE_REALITY_AUDIT.json'))).not.toThrow();
    expect(repoRelative(researchDir('nested'))).toBe('data/research/football_data/nested');
    expect(repoRelative(researchFile('x.json'))).toBe('data/research/football_data/x.json');
  });

  it('REFUSES the production gold directory', () => {
    expect(() => assertResearchSafePath(PRODUCTION_GOLD_DIR)).toThrow(/research-isolation/);
  });

  it('REFUSES every prod-loaded gold artifact individually', () => {
    for (const f of [
      'canonical_matches.jsonl',
      'manifest.json',
      'market_odds.jsonl',
      'market_odds_manifest.json',
      'leagues.json',
      'clusters.json',
      'readiness.json',
      'audit.json',
    ]) {
      expect(() => assertResearchSafePath(path.join(PRODUCTION_GOLD_DIR, f))).toThrow(/research-isolation/);
    }
  });

  it('REFUSES traversal attempts that escape the research root', () => {
    expect(() => assertResearchSafePath(path.join(RESEARCH_ROOT, '..', '..', 'golden', 'europe'))).toThrow(
      /research-isolation/
    );
  });

  it('isProductionGoldPath correctly classifies both worlds', () => {
    expect(isProductionGoldPath(path.join(PRODUCTION_GOLD_DIR, 'market_odds.jsonl'))).toBe(true);
    expect(isProductionGoldPath(RESEARCH_ROOT)).toBe(false);
    expect(isProductionGoldPath(path.join(RESEARCH_ROOT, 'x.json'))).toBe(false);
  });

  it('the research root is never the production gold directory', () => {
    expect(path.resolve(RESEARCH_ROOT)).not.toBe(path.resolve(PRODUCTION_GOLD_DIR));
  });
});
