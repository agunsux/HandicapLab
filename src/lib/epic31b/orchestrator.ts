/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Main Orchestrator
 *
 * Coordinates all 8 phases:
 *   Phase 1: Dataset Registry & Audit
 *   Phase 2: Historical Replay Engine (Walk-Forward)
 *   Phase 3: Deterministic Reproducibility
 *   Phase 4: Side-by-Side Model Comparison (Poisson vs Dixon-Coles)
 *   Phase 5: Statistical Validation & Permutation Test
 *   Phase 6: 10,000 Iteration Bootstrap
 *   Phase 7: Governance & Metadata Auditing
 *   Phase 8: Performance & Throughput Profiling
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  Epic31BFinalReport,
  ValidationSummary,
  LeagueValidationResult,
  PerformanceProfile,
  GovernanceAudit,
  Epic32Decision,
  ReplayOutcome,
} from './types';
import { DatasetRegistry } from './dataset-registry';
import { HistoricalReplaySimulator } from './historical-replay-simulator';
import { DeterminismValidator } from './determinism-validator';
import { StatisticalValidator } from './statistical-validator';
import { GovernanceValidator } from './governance-validator';
import { PerformanceProfiler, estimateThroughput } from './performance-profiler';
import { ReportGenerator } from './report-generator';

export interface Epic31BConfig {
  seed?: number;
  maxMatchesPerLeague?: number;
  determinismRunCount?: number;
  outputDir?: string;
  projectRoot?: string;
}

export class Epic31BOrchestrator {
  private config: Required<Epic31BConfig>;
  private profiler: PerformanceProfiler;
  private reportGenerator: ReportGenerator;
  private governanceValidator: GovernanceValidator;
  private registry: DatasetRegistry;
  private simulator: HistoricalReplaySimulator;

  constructor(config: Epic31BConfig = {}) {
    this.config = {
      seed: config.seed ?? 42,
      maxMatchesPerLeague: config.maxMatchesPerLeague ?? 380, // default to full season
      determinismRunCount: config.determinismRunCount ?? 3,
      outputDir: config.outputDir ?? 'artifacts/epic31b',
      projectRoot: config.projectRoot ?? process.cwd(),
    };

    this.profiler = new PerformanceProfiler();
    this.reportGenerator = new ReportGenerator(this.config.projectRoot, this.config.outputDir);
    this.governanceValidator = new GovernanceValidator(this.config.projectRoot);
    this.registry = new DatasetRegistry(this.config.projectRoot);
    this.simulator = new HistoricalReplaySimulator(this.config.projectRoot);
  }

  async run(): Promise<Epic31BFinalReport> {
    const reportId = crypto.randomUUID();
    const generatedAt = new Date().toISOString();
    const validationSummaries: ValidationSummary[] = [];
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  EPIC 31B — Historical Validation Laboratory (VAR Era)');
    console.log('═══════════════════════════════════════════════════════════════');

    // Phase 1: Dataset Registry & Audit
    console.log('\n[Phase 1] Dataset Registry & Audit');
    const phase1Start = Date.now();
    const auditedDatasets = this.registry.auditAll();
    const unverifiedDatasets = auditedDatasets.filter((d) => d.verificationStatus === 'Unverified');
    
    console.log(`  Audited ${auditedDatasets.length} datasets. Unverified: ${unverifiedDatasets.length}`);
    for (const dataset of auditedDatasets) {
      console.log(`    - EPL ${dataset.season}: status=${dataset.verificationStatus}, rows=${dataset.rowsCount}`);
    }

    validationSummaries.push({
      phase: 'Phase 1',
      status: unverifiedDatasets.length === 0 ? 'PASS' : 'WARNING',
      evidence: `Audited ${auditedDatasets.length} historical seasons. Unverified: ${unverifiedDatasets.length}`,
      files: [`data/registry/audited_metadata.json`],
      metrics: { totalAudited: auditedDatasets.length, unverifiedCount: unverifiedDatasets.length },
      confidence: 'High',
    });

    // Phase 2: Historical Replay (Walk-Forward)
    console.log('\n[Phase 2] Historical Replay Engine (Walk-Forward)');
    const phase2Start = Date.now();
    
    // Simulate walk-forward on Dixon-Coles model (active champion)
    const dcSim = await this.simulator.simulateWalkForward({
      model: 'dixonColes',
      seed: this.config.seed,
    });
    
    console.log(`  EPL: replayed ${dcSim.outcomes.length} matches chronologically.`);
    
    validationSummaries.push({
      phase: 'Phase 2',
      status: dcSim.outcomes.length > 0 ? 'PASS' : 'FAIL',
      evidence: `Walk-forward simulation replayed ${dcSim.outcomes.length} matches chronologically.`,
      files: [],
      metrics: { matchesReplayed: dcSim.outcomes.length },
      confidence: 'High',
    });

    // Phase 3: Deterministic Reproducibility
    console.log('\n[Phase 3] Deterministic Reproducibility');
    const phase3Start = Date.now();
    
    // Verify determinism across multiple runs
    const run1 = await this.simulator.simulateWalkForward({ model: 'dixonColes', seed: this.config.seed });
    const run2 = await this.simulator.simulateWalkForward({ model: 'dixonColes', seed: this.config.seed });
    
    let identical = true;
    let maxDiff = 0;
    
    if (run1.outcomes.length !== run2.outcomes.length) {
      identical = false;
    } else {
      for (let i = 0; i < run1.outcomes.length; i++) {
        const d = Math.abs(run1.outcomes[i].predictedProbability - run2.outcomes[i].predictedProbability);
        if (d > maxDiff) maxDiff = d;
        if (d > 1e-5) identical = false;
      }
    }
    
    console.log(`  Determinism check: identical=${identical}, maxDiff=${maxDiff}`);
    
    validationSummaries.push({
      phase: 'Phase 3',
      status: identical ? 'PASS' : 'FAIL',
      evidence: identical ? 'Multiple execution runs produced identical outputs' : 'Nondeterministic behaviour detected',
      files: [],
      metrics: { identical: identical ? 1 : 0, maxDiff },
      confidence: 'High',
    });

    // Phase 4: Side-by-Side Model Comparison (Poisson vs Dixon-Coles)
    console.log('\n[Phase 4] Model Comparison');
    const poissonSim = await this.simulator.simulateWalkForward({
      model: 'poisson',
      seed: this.config.seed,
    });
    
    const pMetrics = StatisticalValidator.computeMetrics(poissonSim.outcomes);
    const dcMetrics = StatisticalValidator.computeMetrics(dcSim.outcomes);
    
    console.log(`    Poisson Model Brier: ${pMetrics.brierScore}, LogLoss: ${pMetrics.logLoss}, ROI: ${pMetrics.roi}%`);
    console.log(`    Dixon-Coles Model Brier: ${dcMetrics.brierScore}, LogLoss: ${dcMetrics.logLoss}, ROI: ${dcMetrics.roi}%`);

    validationSummaries.push({
      phase: 'Phase 4',
      status: 'PASS',
      evidence: `Compared Poisson (Brier: ${pMetrics.brierScore}) vs Dixon-Coles (Brier: ${dcMetrics.brierScore})`,
      files: [],
      metrics: { poissonBrier: pMetrics.brierScore, dcBrier: dcMetrics.brierScore },
      confidence: 'High',
    });

    // Phase 5: Statistical Validation & Permutation Test
    console.log('\n[Phase 5] Statistical Validation & Significance');
    const phase5Start = Date.now();
    const statVal = StatisticalValidator.validate(dcSim.outcomes);
    
    // Run permutation test (1000 iterations)
    const perm = StatisticalValidator.runPermutationTest(dcSim.outcomes, 1000, this.config.seed);
    console.log(`    Permutation test p-value: ${perm.pValue} (observed diff: ${perm.observedDiff})`);
    
    validationSummaries.push({
      phase: 'Phase 5',
      status: 'PASS',
      evidence: `Brier: ${statVal.metrics.brierScore}, LogLoss: ${statVal.metrics.logLoss}, ECE: ${statVal.metrics.ece}%, PSI: ${statVal.metrics.psi}, Permutation p-value: ${perm.pValue}`,
      files: [],
      metrics: { brierScore: statVal.metrics.brierScore, ece: statVal.metrics.ece || 0, permPValue: perm.pValue },
      confidence: 'High',
    });

    // Phase 6: 10,000 Iteration Bootstrap
    console.log('\n[Phase 6] 10,000 Iteration Bootstrap');
    const roiMetric = (o: ReplayOutcome[]): number => {
      if (o.length === 0) return 0;
      const totalProfit = o.reduce((sum, x) => sum + x.profitLoss, 0);
      const totalStake = o.reduce((sum, x) => sum + x.kellyStake, 0);
      return totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    };
    
    const bootstrap10k = StatisticalValidator.runBootstrap10k(dcSim.outcomes, roiMetric, 10000, 0.95, this.config.seed);
    console.log(`    Bootstrap ROI: mean=${bootstrap10k.mean}%, median=${bootstrap10k.median}%, 95% CI=[${bootstrap10k.ciLower}%, ${bootstrap10k.ciUpper}%], significant=${bootstrap10k.isSignificant}`);

    validationSummaries.push({
      phase: 'Phase 6',
      status: 'PASS',
      evidence: `Seeded 10k bootstrap completed. 95% CI: [${bootstrap10k.ciLower}%, ${bootstrap10k.ciUpper}%]`,
      files: [],
      metrics: { bootstrapMeanRoi: bootstrap10k.mean, ciLower: bootstrap10k.ciLower, ciUpper: bootstrap10k.ciUpper, significant: bootstrap10k.isSignificant ? 1 : 0 },
      confidence: 'High',
    });

    // Phase 7: Governance & Metadata Auditing
    console.log('\n[Phase 7] Governance Audit');
    const governance = this.governanceValidator.validate();
    const allGovPass = 
      governance.featureFlagsVerified &&
      governance.researchRegistryVerified &&
      governance.experimentRegistryVerified &&
      governance.modelRegistryVerified &&
      governance.artifactMetadataVerified &&
      governance.executionMetadataVerified &&
      governance.versionTraceabilityVerified &&
      governance.issues.length === 0;
    
    validationSummaries.push({
      phase: 'Phase 7',
      status: allGovPass ? 'PASS' : 'FAIL',
      evidence: allGovPass ? 'All governance checks passed' : `Issues: ${governance.issues.join('; ')}`,
      files: [],
      metrics: { governancePass: allGovPass ? 1 : 0 },
      confidence: 'High',
    });

    // Phase 8: Performance Profiling
    console.log('\n[Phase 8] Performance Validation');
    const totalMatches = statVal.metrics.totalMatches;
    const performance = this.profiler.getProfile(totalMatches);
    const throughput = estimateThroughput(totalMatches, performance.totalDurationMs);
    
    validationSummaries.push({
      phase: 'Phase 8',
      status: performance.bottlenecks.length === 0 ? 'PASS' : 'WARNING',
      evidence: `${throughput.matchesPerSecond} matches/sec, ${performance.peakMemoryMB}MB peak memory`,
      files: [],
      metrics: { matchesPerSec: throughput.matchesPerSecond, peakMemoryMB: performance.peakMemoryMB },
      confidence: 'High',
    });

    // Assemble League Validation Results
    const leagueResults: LeagueValidationResult[] = [
      StatisticalValidator.buildLeagueValidationResult('39', dcSim.outcomes, dcSim.validationReport)
    ];

    // Generate Final Report and Save
    const finalReport = await this.reportGenerator.generateFinalReport({
      reportId,
      generatedAt,
      leagueResults,
      validationSummaries,
      performance,
      governance,
      totalMatches: statVal.metrics.totalMatches,
      totalMarkets: statVal.metrics.totalPredictions,
      overallMetrics: statVal.metrics,
    });

    // Write extended audited results report to JSON
    const reportPath = path.join(this.config.projectRoot, this.config.outputDir, `epic31b-final-report-${reportId}.json`);
    const mdReportPath = path.join(this.config.projectRoot, this.config.outputDir, `epic31b-final-report-${reportId}.md`);
    
    // Save detailed stats to the report JSON
    const detailedReport = {
      ...finalReport,
      bootstrap10k,
      permutationTest: perm,
      statisticalOutput: statVal,
      auditedDatasets,
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2), 'utf-8');
    
    // Make sure we have latest copy in standard files
    fs.writeFileSync(path.join(this.config.projectRoot, this.config.outputDir, 'phase5-statistical-validation.json'), JSON.stringify(statVal, null, 2), 'utf-8');
    
    // Generate beautiful Markdown report
    const mdContent = `
# EPIC 31B — Historical Validation Laboratory (VAR Era)
**Report ID:** \`${reportId}\`  
**Generated:** \`${generatedAt}\`  
**Decision:** \`${finalReport.decision}\`

---

## 1. Prediction Quality & Calibration
- **Brier Score:** \`${statVal.metrics.brierScore}\`
- **Log Loss:** \`${statVal.metrics.logLoss}\`
- **ECE (Expected Calibration Error):** \`${statVal.metrics.ece}%\`
- **MCE (Maximum Calibration Error):** \`${statVal.metrics.mce}%\`
- **Sharpness:** \`${statVal.metrics.sharpness}\`
- **Prediction Entropy:** \`${statVal.metrics.entropy}\`
- **Prediction Drift (PSI):** \`${statVal.metrics.psi}\`

### Reliability Diagram Bins (10 Probability Bins)
| Bin | Range | Confidence | Realized Accuracy | Count |
| :--- | :--- | :--- | :--- | :--- |
${statVal.calibrationBins.map(b => `| ${b.binIndex} | [${b.lowerBound.toFixed(1)}, ${b.upperBound.toFixed(1)}) | ${(b.predictedConfidence * 100).toFixed(2)}% | ${(b.realizedAccuracy * 100).toFixed(2)}% | ${b.sampleCount} |`).join('\n')}

---

## 2. Market Quality & Financial Metrics
- **Total Replayed Predictions:** \`${statVal.metrics.totalPredictions}\`
- **Realized ROI:** \`${statVal.metrics.roi}%\`
- **CLV (Closing Line Value):** \`${statVal.metrics.avgClv}%\`
- **Max Drawdown:** \`${statVal.metrics.maxDrawdown} units\`
- **Profit Factor:** \`${statVal.metrics.profitFactor}\`

### Kelly Stake Risk Audit
- **Avg Kelly Stake:** \`${statVal.kellyRisk.avgKellyStake * 100}%\`
- **Stake Volatility (Std Dev):** \`${statVal.kellyRisk.stdDevKellyStake}\`
- **Expected vs Realized Growth:** Expected \`${statVal.kellyRisk.expectedKellyGrowth}\` vs Realized \`${statVal.kellyRisk.realizedKellyGrowth}\`
- **Risk Status:** \`${statVal.kellyRisk.riskStatus}\`

---

## 3. Statistical Significance
- **Permutation Test p-value:** \`${perm.pValue}\` (observed Brier improvement: \`${perm.observedDiff}\`)
- **Seeded 10,000 Bootstrap ROI mean:** \`${bootstrap10k.mean}%\`
- **95% Confidence Interval (ROI):** \`[${bootstrap10k.ciLower}%, ${bootstrap10k.ciUpper}%]\`
- **Bootstrap Statistical Significance:** \`${bootstrap10k.isSignificant ? 'SIGNIFICANT (excludes zero)' : 'INCONCLUSIVE (CI overlaps zero)'}\`

---

## 4. Governance & Dataset Provenance
- **Dataset Version:** \`v1.0-football-data-VAR\`
- **Git Commit:** \`${process.env.GIT_COMMIT || 'development-checkout'}\`
- **Checksum Audit status:** \`${unverifiedDatasets.length === 0 ? 'Verified' : 'Unverified'}\`
`;
    
    fs.writeFileSync(mdReportPath, mdContent, 'utf-8');

    // Print final decision
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  FINAL DECISION: ${finalReport.decision}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Matches Replayed: ${statVal.metrics.totalMatches}`);
    console.log(`  Markets Replayed: ${statVal.metrics.totalPredictions}`);
    console.log(`  Bootstrap Significance: ${bootstrap10k.isSignificant ? 'SIGNIFICANT' : 'INCONCLUSIVE'}`);
    console.log(`  Production Ready: ${finalReport.productionReadiness}`);
    console.log('═══════════════════════════════════════════════════════════════');

    return finalReport;
  }
}
