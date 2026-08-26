// Test Suite for EPIC 60 Stage A — Empirical Ablation & Circularity Audit
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runStageAAblation } from '../src/lib/research/epic60-stage-a-ablation';

describe('EPIC 60 Stage A — Empirical Ablation & Circularity Audit', () => {
  const report = runStageAAblation();

  it('should execute over exactly 1,140 OOS matches across 3 walk-forward folds', () => {
    expect(report.totalOosMatches).toBe(1140);
    expect(report.foldsCount).toBe(3);
  });

  it('should confirm 100% mathematical and outcome equivalence between ML and AH line 0.0 in Model 0 and Model 1', () => {
    expect(report.correlationDiagnostics.model0_ml_vs_ah0_identical_pct).toBe(100);
    expect(report.correlationDiagnostics.model1_ml_vs_ah0_identical_pct).toBe(100);
    expect(report.correlationDiagnostics.model0_pearson_corr).toBeCloseTo(1.0, 4);
    expect(report.correlationDiagnostics.model1_pearson_corr).toBeCloseTo(1.0, 4);
    expect(report.correlationDiagnostics.target_identical_pct).toBe(100);

    // Exact Brier identity to 4 decimal places
    expect(report.models.model_0_baseline.moneyline.brierScore).toBe(
      report.models.model_0_baseline.asianHandicap0.brierScore
    );
    expect(report.models.model_1_football_only.moneyline.brierScore).toBe(
      report.models.model_1_football_only.asianHandicap0.brierScore
    );
  });

  it('should prove Table B reported Model 2 AH Brier (0.5892) diverges from actual code execution (0.6421)', () => {
    expect(report.reportAnomalyAudit.tableB_reported_m2_ah_brier).toBe(0.5892);
    expect(report.models.model_2_market_ensemble_standard.asianHandicap0_unblended_in_code.brierScore).toBe(0.6421);
    expect(report.reportAnomalyAudit.reproducible_via_tableA_copy_paste).toBe(true);
  });

  it('should demonstrate that market odds blending strictly improves Moneyline Brier (0.6421 -> ~0.5850)', () => {
    const sweep = report.weightSweep;
    const pureFootball = sweep.find((s) => s.marketWeight === 0.0)!;
    const pureMarket = sweep.find((s) => s.marketWeight === 1.0)!;
    const standardBlend = sweep.find((s) => s.marketWeight === 0.35)!;

    expect(pureFootball.mlBrier).toBe(0.6421);
    expect(pureMarket.mlBrier).toBeLessThan(0.60);
    expect(standardBlend.mlBrier).toBeLessThan(pureFootball.mlBrier);
  });

  it('should deliver explicit high-confidence CIRCULAR verdict and persist report artifact', () => {
    expect(report.verdict).toBe('CIRCULAR');
    expect(report.confidence).toBe('High');
    expect(report.evidence.length).toBeGreaterThanOrEqual(3);

    const outDir = path.resolve(process.cwd(), 'data', 'verification');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(outDir, 'EPIC60_STAGE_A_ABLATION_REPORT.json'),
      JSON.stringify(report, null, 2),
      'utf8'
    );
    expect(fs.existsSync(path.join(outDir, 'EPIC60_STAGE_A_ABLATION_REPORT.json'))).toBe(true);
  });
});
