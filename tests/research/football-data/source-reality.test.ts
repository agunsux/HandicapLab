// Source-reality audit — regression guard for the facts the SALMO evidence layer
// depends on, plus the provenance defect (D5) that silently corrupts CLV.
// Location: tests/research/football-data/source-reality.test.ts

import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  auditSourceReality,
  classifyAhLine,
  classifyOuLine,
  enumerateSourceFiles,
  normalizeProvenance,
  readSourceSchema,
} from '../../../src/research/football-data/sourceReality';
import { BRONZE_MAIN_DIR } from '../../../src/research/football-data/researchPaths';

describe('line classification', () => {
  it('classifies AH lines into whole / half / quarter', () => {
    expect(classifyAhLine(0)).toBe('AH_WHOLE');
    expect(classifyAhLine(-1)).toBe('AH_WHOLE');
    expect(classifyAhLine(-0.5)).toBe('AH_HALF');
    expect(classifyAhLine(1.5)).toBe('AH_HALF');
    expect(classifyAhLine(-0.25)).toBe('AH_QUARTER');
    expect(classifyAhLine(0.75)).toBe('AH_QUARTER');
    expect(classifyAhLine(-2.75)).toBe('AH_QUARTER');
  });

  it('classifies OU lines into whole / half / quarter', () => {
    expect(classifyOuLine(2.5)).toBe('OU_HALF');
    expect(classifyOuLine(3)).toBe('OU_WHOLE');
    expect(classifyOuLine(2.75)).toBe('OU_QUARTER');
  });

  it('normalises provenance labels', () => {
    expect(normalizeProvenance('pinnacle')).toBe('pinnacle');
    expect(normalizeProvenance('bet365')).toBe('bet365');
    expect(normalizeProvenance('betbrain')).toBe('betbrain_average');
    expect(normalizeProvenance('')).toBe('unknown');
  });
});

describe('raw source schema (real files on disk)', () => {
  it('detects the ERA1 → ERA2 boundary from actual columns', () => {
    const era1 = readSourceSchema(path.join(BRONZE_MAIN_DIR, '2015-2016.csv'), '2015-2016', 'main');
    const era2 = readSourceSchema(path.join(BRONZE_MAIN_DIR, '2019-2020.csv'), '2019-2020', 'main');

    expect(era1.era).toBe('ERA1_BETBRAIN');
    expect(era2.era).toBe('ERA2_PINNACLE');

    // ERA1: Pinnacle 1X2 present, but NO Pinnacle AH/OU columns at all.
    expect(era1.pinnacle.mlOpen).toBe(true);
    expect(era1.pinnacle.mlClose).toBe(true);
    expect(era1.pinnacle.ahOpen).toBe(false);
    expect(era1.pinnacle.ahClose).toBe(false);
    expect(era1.pinnacle.ouOpen).toBe(false);
    expect(era1.pinnacle.ouClose).toBe(false);
    // Only the BetBrain AH aggregate carries a line in ERA1.
    expect(era1.ahLineColumns).toEqual(['BbAHh']);

    // ERA2: the complete Pinnacle family.
    expect(era2.pinnacle).toEqual({
      mlOpen: true,
      mlClose: true,
      ahOpen: true,
      ahClose: true,
      ouOpen: true,
      ouClose: true,
    });
    expect(era2.ahLineColumns).toContain('AHh');
    expect(era2.ahLineColumns).toContain('AHCh');
  });

  it('documents schema drift and finds only the 2.5 OU label in raw headers', () => {
    const files = enumerateSourceFiles();
    expect(files.length).toBeGreaterThanOrEqual(28);

    const cols = files.map((f) => f.columns);
describe('source reality audit against the frozen gold layer', () => {
  it('proves OU depth, BTTS absence and the D5 provenance defect', async () => {
    const report = await auditSourceReality({ write: false });

    // 1. OU is a single point: exactly 2.5, zero quarter lines.
    expect(report.ouDistinctLines).toEqual([2.5]);
    const ouLines = report.lineInventory.filter((l) => l.market === 'OU');
    expect(ouLines).toHaveLength(1);
    expect(ouLines[0].line).toBe(2.5);
    expect(ouLines[0].lineType).toBe('OU_HALF');
    expect(ouLines[0].isQuarter).toBe(false);

    // 2. AH genuinely carries quarter lines (rich line coverage).
    const ahQuarters = report.lineInventory.filter((l) => l.market === 'AH' && l.isQuarter);
    expect(ahQuarters.length).toBeGreaterThan(10);
    expect(report.ahDistinctLines.length).toBeGreaterThan(20);

    // 3. BTTS does not exist in the source.
    expect(report.bttsSupported).toBe(false);
    expect(report.lineInventory.some((l) => l.market === 'BTTS')).toBe(false);

    // 4. Era split, derived from real columns.
    expect(report.findings.some((f) => f.includes('ERA1_BETBRAIN: 4 seasons'))).toBe(true);
    expect(report.findings.some((f) => f.includes('ERA2_PINNACLE: 7 seasons'))).toBe(true);

    // 5. D5: Pinnacle AH-opening rows exist in an era with no Pinnacle AH columns.
    const ahOpenPinnacle = report.marketAvailability.find(
      (m) => m.market === 'AH' && m.snapshot === 'opening' && m.provenance === 'pinnacle'
    );
    expect(ahOpenPinnacle).toBeDefined();
    expect(ahOpenPinnacle!.mislabeledOrUntradeable).toBe(true);

    // 6. Fingerprint of the defect: the mislabeled rows carry the BetBrain
    //    aggregate seasons too — proof they are the same numbers relabelled.
    const ahOpenBetbrain = report.marketAvailability.find(
      (m) => m.market === 'AH' && m.snapshot === 'opening' && m.provenance === 'betbrain_average'
    );
    expect(ahOpenBetbrain).toBeDefined();

    const era1 = ['2015-2016', '2016-2017', '2017-2018', '2018-2019'];
    expect(ahOpenBetbrain!.seasons.filter((s) => era1.includes(s))).toEqual(era1);
    expect(ahOpenBetbrain!.rows).toBe(5858);
    expect(ahOpenPinnacle!.rows).toBeGreaterThan(ahOpenBetbrain!.rows);

    // 7. The same defect hits OU opening.
    const ouOpenPinnacle = report.marketAvailability.find(
      (m) => m.market === 'OU' && m.snapshot === 'opening' && m.provenance === 'pinnacle'
    );
    expect(ouOpenPinnacle!.mislabeledOrUntradeable).toBe(true);

    // 8. Pinnacle AH CLOSING exists only for ERA2 — never in ERA1.
    const ahClosePinnacle = report.marketAvailability.find(
      (m) => m.market === 'AH' && m.snapshot === 'closing' && m.provenance === 'pinnacle'
    );
    expect(ahClosePinnacle).toBeDefined();
    expect(ahClosePinnacle!.mislabeledOrUntradeable).toBe(false);
    expect(ahClosePinnacle!.seasons).not.toContain('2015-2016');

    // 9. ML Pinnacle is genuine in both eras (PSH/PSCH exist in every file).
    const mlOpenPinnacle = report.marketAvailability.find(
      (m) => m.market === 'ML' && m.snapshot === 'opening' && m.provenance === 'pinnacle'
    );
    expect(mlOpenPinnacle!.mislabeledOrUntradeable).toBe(false);

    // 10. Limitations are always disclosed (licensing + snapshot grid).
    expect(report.limitations.length).toBeGreaterThanOrEqual(4);
    expect(report.limitations.some((l) => l.includes('licensing forbids'))).toBe(true);
    expect(report.limitations.some((l) => l.includes('Opening/closing'))).toBe(true);

    // 11. Reproducibility: a second run yields identical facts.
    const again = await auditSourceReality({ write: false });
    expect(again.ouDistinctLines).toEqual(report.ouDistinctLines);
    expect(again.marketAvailability).toEqual(report.marketAvailability);
    expect(again.lineInventory).toEqual(report.lineInventory);
  }, 120_000);
});

    expect(Math.min(...cols)).toBeLessThanOrEqual(61);
    expect(Math.max(...cols)).toBeGreaterThanOrEqual(132);

    // Every generation can express only the 2.5 OU line.
    for (const f of files) expect(f.ouLineLabels).toEqual(['2.5']);
  });

  it('surfaces raw columns the production reader ignores', () => {
    const era2 = readSourceSchema(path.join(BRONZE_MAIN_DIR, '2025-2026.csv'), '2025-2026', 'main');
    expect(era2.unusedButPresent).toContain('MaxH');
    expect(era2.unusedButPresent).toContain('AvgH');
    expect(era2.unusedButPresent).toContain('Time');
    expect(era2.unusedButPresent.length).toBeGreaterThan(50);
  });
});
