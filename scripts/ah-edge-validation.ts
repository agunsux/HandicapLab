// AH EDGE ENGINE — validation runner.
// Runs the full research protocol on real data and writes:
//   data/verification/AH_EDGE_VALIDATION_REPORT.json
//   reports/AH_PROBABILITY_EDGE_VALIDATION_REPORT.md
//
// Usage: npx tsx scripts/ah-edge-validation.ts
// No network access; fails closed on missing data.

import * as fs from 'fs';
import * as path from 'path';
import {
  BETBRAIN_CONSENSUS_COHORT,
  PINNACLE_CLOSING_COHORT,
  PINNACLE_OPENING_COHORT,
  buildEdgeDataset,
} from '../src/lib/research/ah-edge/edgeData';
import { DEFAULT_MODEL_IDS, runEdgeWalkForward } from '../src/lib/research/ah-edge/edgeWalkForward';
import {
  breakdownByFavorite,
  breakdownByLeague,
  breakdownByLine,
  runFeatureAblation,
  runLeaveOneLeagueOut,
  thresholdSweepFromPredictions,
} from '../src/lib/research/ah-edge/edgeExperiments';
import {
  buildEdgeValidationReport,
  renderEdgeValidationMarkdown,
  type EdgeCohortReportInput,
  type ResearchLogEntry,
} from '../src/lib/research/ah-edge/edgeReport';
import { ALL_FEATURE_GROUPS } from '../src/lib/research/ah-edge/edgeTypes';

function main(): void {
  const started = Date.now();

  console.log('[ah-edge] building datasets from frozen real data...');
  const closing = buildEdgeDataset(PINNACLE_CLOSING_COHORT);
  const opening = buildEdgeDataset(PINNACLE_OPENING_COHORT);
  const betbrain = buildEdgeDataset(BETBRAIN_CONSENSUS_COHORT);
  console.log(
    `[ah-edge] cohorts: pinnacle closing ${closing.matches.length}, opening ${opening.matches.length}, betbrain ${betbrain.matches.length}`
  );

  const modelConfig = { groups: [...ALL_FEATURE_GROUPS] };
  const thresholds = [0, 0.01, 0.02, 0.03, 0.05, 0.07, 0.1];

  console.log('[ah-edge] primary walk-forward (pinnacle closing)...');
  const closingRun = runEdgeWalkForward(closing.matches, {
    modelIds: DEFAULT_MODEL_IDS,
    modelConfig,
    minTrainSeasons: 2,
    thresholds,
    minThresholdBets: 100,
  });

  console.log('[ah-edge] secondary walk-forward (pinnacle opening)...');
  const openingRun = runEdgeWalkForward(opening.matches, {
    modelIds: DEFAULT_MODEL_IDS,
    modelConfig,
    minTrainSeasons: 2,
    thresholds,
    minThresholdBets: 100,
  });

  console.log('[ah-edge] secondary walk-forward (betbrain consensus)...');
  const betbrainRun = runEdgeWalkForward(betbrain.matches, {
    modelIds: DEFAULT_MODEL_IDS,
    modelConfig,
    minTrainSeasons: 2,
    thresholds,
    minThresholdBets: 100,
  });

  const toCohortInput = (
    config: typeof closing.cohort,
    dataset: typeof closing,
    run: typeof closingRun
  ): EdgeCohortReportInput => ({
    config,
    coverage: dataset.coverage,
    missingness: dataset.missingness,
    run,
    lineBreakdown: breakdownByLine(run.predictionsByModel, DEFAULT_MODEL_IDS),
    favoriteBreakdown: breakdownByFavorite(run.predictionsByModel, DEFAULT_MODEL_IDS),
    leagueBreakdown: breakdownByLeague(run.predictionsByModel, DEFAULT_MODEL_IDS),
    thresholdSweep: thresholdSweepFromPredictions(run.predictionsByModel, DEFAULT_MODEL_IDS, thresholds),
  });

  const cohorts: EdgeCohortReportInput[] = [
    toCohortInput(closing.cohort, closing, closingRun),
    toCohortInput(opening.cohort, opening, openingRun),
    toCohortInput(betbrain.cohort, betbrain, betbrainRun),
  ];

  console.log('[ah-edge] feature ablation (poisson GLM, primary cohort)...');
  const ablation = runFeatureAblation(closing.matches, { modelId: 'poisson_glm' });

  console.log('[ah-edge] leave-one-league-out (betbrain consensus)...');
  const logo = runLeaveOneLeagueOut(betbrain.matches, {
    modelId: 'poisson_glm',
    modelConfig,
    minTrainMatches: 800,
    minTestMatches: 100,
  });

  const primarySummary = closingRun.report.models.map((m) => ({
    id: m.modelId,
    brier: m.brier,
    marketBrier: closingRun.report.market.brier,
    evPositiveRoi: m.evPositive.roi,
    bets: m.bets,
  }));

  const researchLog: ResearchLogEntry[] = [
    {
      experimentId: 'E1',
      description: 'Baselines + models on genuine Pinnacle closing AH (primary)',
      features: ALL_FEATURE_GROUPS,
      model: DEFAULT_MODEL_IDS.join(', '),
      parameters: { minTrainSeasons: 2, thresholds, history: 'expanding season windows' },
      trainPeriod: '2019-20..2024-25 (expanding)',
      validationPeriod: 'inner last train season',
      oosPeriod: '2021-22..2025-26',
      results: { marketBrier: closingRun.report.market.brier, models: primarySummary },
    },
    {
      experimentId: 'E2',
      description: 'Opening snapshot evaluation (same protocol)',
      features: ALL_FEATURE_GROUPS,
      model: DEFAULT_MODEL_IDS.join(', '),
      parameters: { minTrainSeasons: 2 },
      trainPeriod: '2019-20..2024-25 (expanding)',
      validationPeriod: 'inner last train season',
      oosPeriod: '2021-22..2025-26',
      results: {
        marketBrier: openingRun.report.market.brier,
        bestModel: openingRun.report.models[0]?.modelId,
        bestBrier: openingRun.report.models[0]?.brier,
      },
    },
    {
      experimentId: 'E3',
      description: 'BetBrain consensus cohort (top-5 leagues, wider but higher-margin market)',
      features: ALL_FEATURE_GROUPS,
      model: DEFAULT_MODEL_IDS.join(', '),
      parameters: { minTrainSeasons: 2 },
      trainPeriod: '2016-17..2018-19 (expanding)',
      validationPeriod: 'inner last train season',
      oosPeriod: '2018-19..2019-20',
      results: {
        marketBrier: betbrainRun.report.market.brier,
        bestModel: betbrainRun.report.models[0]?.modelId,
        bestBrier: betbrainRun.report.models[0]?.brier,
      },
    },
    {
      experimentId: 'E4',
      description: 'EV threshold sweep (all thresholds reported; selected on inner validation)',
      features: ALL_FEATURE_GROUPS,
      model: DEFAULT_MODEL_IDS.join(', '),
      parameters: { thresholds },
      trainPeriod: 'expanding seasons',
      validationPeriod: 'inner last train season',
      oosPeriod: 'primary test seasons',
      results: {
        evPositiveRoiByModel: Object.fromEntries(
          closingRun.report.models.map((m) => [m.modelId, m.evPositive.roi])
        ),
      },
    },
    {
      experimentId: 'E5',
      description: 'Cumulative feature-group ablation (Poisson GLM, primary cohort)',
      features: ['market', '+form', '+rest', '+elo', '+league'],
      model: 'poisson_glm',
      parameters: { epochs: 900 },
      trainPeriod: 'expanding seasons',
      validationPeriod: 'inner last train season',
      oosPeriod: 'primary test seasons',
      results: {
        rows: ablation.map((a) => ({ groups: a.groups, brier: a.brier, evPositiveRoi: a.evPositiveRoi })),
      },
    },
    {
      experimentId: 'E6',
      description: 'Leave-one-league-out generalization (train other leagues earlier, test held-out league)',
      features: ALL_FEATURE_GROUPS,
      model: 'poisson_glm',
      parameters: { minTrainMatches: 800, minTestMatches: 100 },
      trainPeriod: 'other leagues strictly earlier',
      validationPeriod: 'none (direct OOS)',
      oosPeriod: 'held-out league seasons',
      results: {
        rows: logo.map((l) => ({ league: l.leagueId, bets: l.bets, brier: l.modelBrier, market: l.marketBrier })),
      },
    },
    {
      experimentId: 'E7',
      description: 'Line and favorite/underdog breakdowns from primary OOS predictions',
      features: ALL_FEATURE_GROUPS,
      model: DEFAULT_MODEL_IDS.join(', '),
      parameters: { minSampleReported: 30 },
      trainPeriod: 'expanding seasons',
      validationPeriod: 'inner last train season',
      oosPeriod: 'primary test seasons',
      results: {
        lineCount: cohorts[0].lineBreakdown.length,
        favoriteRows: cohorts[0].favoriteBreakdown.length,
      },
    },
  ];

  const report = buildEdgeValidationReport({
    generatedAt: new Date().toISOString(),
    primaryCohortId: closing.cohort.id,
    cohorts,
    ablation,
    leagueGeneralization: logo,
    researchLog,
  });

  const verificationDir = path.join(process.cwd(), 'data', 'verification');
  const reportsDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(verificationDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });

  const jsonPath = path.join(verificationDir, 'AH_EDGE_VALIDATION_REPORT.json');
  const mdPath = path.join(reportsDir, 'AH_PROBABILITY_EDGE_VALIDATION_REPORT.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, renderEdgeValidationMarkdown(report));

  console.log(`[ah-edge] complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`[ah-edge] verdict: ${report.verdict.code}. ${report.verdict.label}`);
  for (const r of report.verdict.reasons) console.log(`  - ${r}`);
  console.log(`[ah-edge] JSON: ${jsonPath}`);
  console.log(`[ah-edge] Markdown: ${mdPath}`);
}

main();
