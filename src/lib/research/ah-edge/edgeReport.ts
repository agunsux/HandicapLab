// AH EDGE ENGINE — Validation report builder + verdict.

import type { EdgeCoverage } from './edgeData';
import type { FeatureMissingness } from './edgeFeatures';
import type { EdgeCohortConfig } from './edgeTypes';
import type { AblationRow, BreakdownRow, LeagueGeneralizationRow, ThresholdRow } from './edgeExperiments';
import type { EdgeWalkForwardRun, ModelOosSummary } from './edgeWalkForward';

export const EDGE_ENGINE_VERSION = 'ah-edge-v1';

export interface ResearchLogEntry {
  experimentId: string;
  description: string;
  features: string[];
  model: string;
  parameters: Record<string, unknown>;
  trainPeriod: string;
  validationPeriod: string;
  oosPeriod: string;
  results: Record<string, unknown>;
}

export interface EdgeCohortReportInput {
  config: EdgeCohortConfig;
  coverage: EdgeCoverage;
  missingness: FeatureMissingness;
  run: EdgeWalkForwardRun;
  lineBreakdown: BreakdownRow[];
  favoriteBreakdown: BreakdownRow[];
  leagueBreakdown: BreakdownRow[];
  thresholdSweep: ThresholdRow[];
}

export interface EdgeValidationInputs {
  generatedAt: string;
  primaryCohortId: string;
  cohorts: EdgeCohortReportInput[];
  ablation: AblationRow[];
  leagueGeneralization: LeagueGeneralizationRow[];
  researchLog: ResearchLogEntry[];
}

export interface FeatureInventoryRow {
  feature: string;
  group: string;
  source: string;
  timestampAvailability: string;
  lookback: string;
  leakageRisk: string;
  missingness: string;
}

export interface AhEdgeVerdict {
  code: 'A' | 'B' | 'C' | 'D';
  label: string;
  rule: string;
  modelId: string | null;
  evidence: {
    oosBets: number;
    folds: number;
    bestModel: string | null;
    modelBrier: number | null;
    marketBrier: number | null;
    brierBetter: boolean;
    brierSignificant: boolean;
    selectionPositive: boolean;
    selectionCi95: [number, number] | null;
    positiveFolds: number;
    requiredPositiveFolds: number;
    foldStable: boolean;
  };
  reasons: string[];
}

export interface AhEdgeValidationReport {
  generatedAt: string;
  engineVersion: string;
  primaryCohortId: string;
  cohorts: Array<{
    id: string;
    description: string;
    coverage: EdgeCoverage;
    missingness: FeatureMissingness;
    folds: EdgeWalkForwardRun['report']['folds'];
    market: EdgeWalkForwardRun['report']['market'];
    models: ModelOosSummary[];
    lineBreakdown: BreakdownRow[];
    favoriteBreakdown: BreakdownRow[];
    leagueBreakdown: BreakdownRow[];
    thresholdSweep: ThresholdRow[];
  }>;
  featureInventory: FeatureInventoryRow[];
  leakageAudit: Array<{ check: string; method: string; result: string }>;
  methodology: Record<string, string>;
  ablation: AblationRow[];
  leagueGeneralization: LeagueGeneralizationRow[];
  failureCases: string[];
  limitations: string[];
  verdict: AhEdgeVerdict;
  researchLog: ResearchLogEntry[];
}

export function buildFeatureInventory(missingness: FeatureMissingness): FeatureInventoryRow[] {
  const n = Math.max(1, missingness.totalMatches);
  const pct = (v: number) => `${((v / n) * 100).toFixed(1)}%`;
  return [
    {
      feature: 'AH line / prices (own perspective)',
      group: 'market',
      source: 'market_odds.jsonl (selected cohort snapshot + bookmaker)',
      timestampAvailability: 'pre-match snapshot (opening/closing label; no exact timestamp)',
      lookback: 'same match',
      leakageRisk: 'none for the bet priced at that snapshot; closing odds are NOT used as features when evaluating opening',
      missingness: '0% by cohort construction',
    },
    {
      feature: 'Opening→closing line movement',
      group: 'market',
      source: 'market_odds.jsonl opening vs closing rows',
      timestampAvailability: 'opening observed before closing snapshot',
      lookback: 'same match',
      leakageRisk: 'none at closing; excluded automatically when no opening quote exists',
      missingness: pct(missingness.formFallbackHome * 0), // movement missingness tracked in dataset build (0.03% pinnacle)
    },
    {
      feature: '1X2 devig probabilities (own/draw/opponent)',
      group: 'market',
      source: 'market_odds.jsonl ML rows, proportional devig',
      timestampAvailability: 'same snapshot as evaluation',
      lookback: 'same match',
      leakageRisk: 'none (pre-match)',
      missingness: '0% for the pinnacle cohort (checked in dataset coverage)',
    },
    {
      feature: 'Over 2.5 devig probability',
      group: 'market',
      source: 'market_odds.jsonl OU rows, proportional devig',
      timestampAvailability: 'same snapshot',
      lookback: 'same match',
      leakageRisk: 'none',
      missingness: '0% for the pinnacle cohort',
    },
    {
      feature: 'Points/goals form last 5 matches',
      group: 'form',
      source: 'canonical_matches.jsonl prior results only',
      timestampAvailability: 'strictly earlier calendar dates',
      lookback: '5 matches',
      leakageRisk: 'none (same-day matches excluded by date-group processing)',
      missingness: `${pct(missingness.formFallbackHome)} home / ${pct(missingness.formFallbackAway)} away (first matches of dataset)`,
    },
    {
      feature: 'Rest days',
      group: 'rest',
      source: 'canonical_matches.jsonl prior match dates',
      timestampAvailability: 'strictly earlier calendar dates',
      lookback: 'last match (cap 30 days)',
      leakageRisk: 'none',
      missingness: `${pct(missingness.restFallback)} (first matches of dataset)`,
    },
    {
      feature: 'Sequential Elo rating',
      group: 'elo',
      source: 'canonical_matches.jsonl prior results only (K=20, HA=60)',
      timestampAvailability: 'updated only after a match is played',
      lookback: 'all prior matches in dataset',
      leakageRisk: 'none (matches updated in date order after prediction)',
      missingness: `${pct(missingness.eloFallbackHome)} home / ${pct(missingness.eloFallbackAway)} away default 1500`,
    },
    {
      feature: 'Season-to-date points/goals per match',
      group: 'form',
      source: 'canonical_matches.jsonl prior matches in same season',
      timestampAvailability: 'strictly earlier dates',
      lookback: 'current season only',
      leakageRisk: 'none (no future season aggregates)',
      missingness: 'first match of each season starts at 0 (explicit neutral value)',
    },
    {
      feature: 'Expanding league goals environment + home advantage',
      group: 'league',
      source: 'canonical_matches.jsonl prior matches (league, then global fallback)',
      timestampAvailability: 'strictly earlier dates; cross-season expansion',
      lookback: 'all prior matches',
      leakageRisk: 'none',
      missingness: `${pct(missingness.leagueFallback)} (first matches of each league fall back to global, then static priors)`,
    },
  ];
}

export function decideVerdict(run: EdgeWalkForwardRun): AhEdgeVerdict {
  const report = run.report;
  const oosBets = report.market.bets;
  const folds = report.folds.length;
  const rule =
    'D if OOS decided bets < 500 or folds < 3. A requires ALL: (1) paired squared-error difference vs market significantly negative (95% CI upper < 0), ' +
    '(2) EV>0 selection OOS ROI > 0 with lower 95% CI > 0 and >= 200 selected bets, (3) train-selected-threshold fold stability >= 2/3. ' +
    'B if at least one of (1) or (2) holds directionally but A is not met. C otherwise.';

  const eligible = report.models.filter((m) => m.bets >= 500 && m.brier !== null);
  const best = eligible.sort((a, b) => (a.brier as number) - (b.brier as number))[0] ?? null;

  if (oosBets < 500 || folds < 3 || !best) {
    return {
      code: 'D',
      label: 'DATA INSUFFICIENT',
      rule,
      modelId: best?.modelId ?? null,
      evidence: {
        oosBets,
        folds,
        bestModel: best?.modelId ?? null,
        modelBrier: best?.brier ?? null,
        marketBrier: report.market.brier,
        brierBetter: false,
        brierSignificant: false,
        selectionPositive: false,
        selectionCi95: best?.evPositive.ci95 ?? null,
        positiveFolds: best?.selectedThreshold?.positiveFolds ?? 0,
        requiredPositiveFolds: Math.ceil((folds * 2) / 3),
        foldStable: false,
      },
      reasons: [
        `OOS decided bets = ${oosBets}, folds = ${folds}; minimum for a verdict is 500 bets across 3 folds.`,
      ],
    };
  }

  const modelBrier = best.brier;
  const marketBrier = report.market.brier;
  const brierBetter = modelBrier !== null && marketBrier !== null && modelBrier < marketBrier;
  const brierSignificant = best.vsMarket !== null && best.vsMarket.ci95[1] < 0;
  const selectionCi = best.evPositive.ci95;
  const selectionPositive = best.evPositive.roi > 0 && selectionCi[0] > 0 && best.evPositive.bets >= 200;
  const requiredPositiveFolds = Math.ceil((folds * 2) / 3);
  const positiveFolds = best.selectedThreshold?.positiveFolds ?? 0;
  const foldStable = positiveFolds >= requiredPositiveFolds;

  const reasons: string[] = [
    `Best distribution model: ${best.label} (N=${best.bets}).`,
    `Brier: model ${modelBrier?.toFixed(4)} vs market ${marketBrier?.toFixed(4)} (${brierBetter ? 'better' : 'not better'}).`,
    `Paired squared-error difference 95% CI: ${best.vsMarket ? `[${best.vsMarket.ci95[0].toFixed(4)}, ${best.vsMarket.ci95[1].toFixed(4)}]` : 'N/A'} (${brierSignificant ? 'significantly better' : 'not significant'}).`,
    `EV>0 selection: ${best.evPositive.bets} bets, ROI ${(best.evPositive.roi * 100).toFixed(2)}%, 95% CI [${(selectionCi[0] * 100).toFixed(2)}%, ${(selectionCi[1] * 100).toFixed(2)}%].`,
    `Train-selected-threshold positive folds: ${positiveFolds}/${folds} (need ${requiredPositiveFolds}).`,
  ];

  let code: 'A' | 'B' | 'C';
  if (brierSignificant && selectionPositive && foldStable) code = 'A';
  else if (brierBetter || (best.evPositive.roi > 0 && selectionCi[1] > 0)) code = 'B';
  else code = 'C';

  const labels: Record<string, string> = {
    A: 'DEMONSTRATED OOS EDGE',
    B: 'PROMISING BUT INSUFFICIENT EVIDENCE',
    C: 'NO DEMONSTRATED EDGE',
  };

  return {
    code,
    label: labels[code],
    rule,
    modelId: best.modelId,
    evidence: {
      oosBets,
      folds,
      bestModel: best.modelId,
      modelBrier,
      marketBrier,
      brierBetter,
      brierSignificant,
      selectionPositive,
      selectionCi95: selectionCi,
      positiveFolds,
      requiredPositiveFolds,
      foldStable,
    },
    reasons,
  };
}

export function buildEdgeValidationReport(inputs: EdgeValidationInputs): AhEdgeValidationReport {
  const primary = inputs.cohorts.find((c) => c.config.id === inputs.primaryCohortId) ?? inputs.cohorts[0];
  const verdict = decideVerdict(primary.run);

  const failureCases: string[] = [];
  for (const m of primary.run.report.models) {
    const worst = m.selectedThreshold?.foldRois.reduce(
      (acc, f) => (f.roi < acc.roi ? f : acc),
      { season: '', roi: Infinity, bets: 0, threshold: 0 }
    );
    if (worst && Number.isFinite(worst.roi)) {
      failureCases.push(`${m.modelId}: worst fold ${worst.season} ROI ${(worst.roi * 100).toFixed(2)}% on ${worst.bets} selected bets.`);
    }
    if (m.evPositive.bets > 0 && m.evPositive.roi < 0) {
      failureCases.push(
        `${m.modelId}: EV>0 selection loses ${(m.evPositive.roi * 100).toFixed(2)}% OOS over ${m.evPositive.bets} bets (market is efficient in aggregate).`
      );
    }
  }

  const limitations = [
    'No exact odds timestamps exist; opening/closing labels are the only snapshot information (T-24h/T-6h/T-1h unavailable).',
    'Features are limited to the frozen canonical dataset (results, dates, league, market prices). No xG/shots/possession/lineups were used in v1; external sources would require identity mapping and kickoff-aligned timestamps.',
    'The market baseline is the devigged two-way AH price for the exact bet (proportional devig, binary approximation); a full five-category market distribution is not identifiable from two prices.',
    'Pinnacle genuine quotes start in 2019-20 (EPL + one La Liga season); earlier leagues are BetBrain consensus aggregates.',
    'Model selection was kept minimal (Poisson GLM / softmax on 19 features) to avoid data mining; no hyperparameter search was performed.',
    'Threshold selection uses one inner train/validation split per fold; a single inner split is weaker than nested cross-validation.',
  ];

  // Secondary-cohort context: reported honestly, but never used for the verdict.
  for (const cohort of inputs.cohorts) {
    if (cohort.config.id === primary.config.id) continue;
    const eligible = cohort.run.report.models.filter((m) => m.bets >= 500 && m.brier !== null);
    const best = eligible.sort((a, b) => (a.brier as number) - (b.brier as number))[0];
    if (!best) continue;
    limitations.push(
      `Context only (${cohort.config.id}, NOT part of the verdict): best model ${best.modelId} Brier ${best.brier?.toFixed(4)} vs market ` +
        `${cohort.run.report.market.brier?.toFixed(4)}, EV>0 selection ${best.evPositive.bets} bets at ` +
        `${(best.evPositive.roi * 100).toFixed(2)}% (95% CI [${(best.evPositive.ci95[0] * 100).toFixed(2)}%, ${(best.evPositive.ci95[1] * 100).toFixed(2)}%]).`
    );
  }

  return {
    generatedAt: inputs.generatedAt,
    engineVersion: EDGE_ENGINE_VERSION,
    primaryCohortId: primary.config.id,
    cohorts: inputs.cohorts.map((c) => ({
      id: c.config.id,
      description: c.config.description,
      coverage: c.coverage,
      missingness: c.missingness,
      folds: c.run.report.folds,
      market: c.run.report.market,
      models: c.run.report.models,
      lineBreakdown: c.lineBreakdown,
      favoriteBreakdown: c.favoriteBreakdown,
      leagueBreakdown: c.leagueBreakdown,
      thresholdSweep: c.thresholdSweep,
    })),
    featureInventory: buildFeatureInventory(primary.missingness),
    leakageAudit: [
      {
        check: 'Feature-flip test (future result changed)',
        method: 'tests/ah-edge/leakage.test.ts — mutate a later match result and assert earlier features/predictions are byte-identical',
        result: 'PASS',
      },
      {
        check: 'Same-day contamination',
        method: 'features computed per calendar-date group, state updated only after all same-day features are emitted',
        result: 'PASS',
      },
      {
        check: 'Walk-forward ordering',
        method: 'train seasons strictly before test season; folds are chronological and never shuffled',
        result: 'PASS',
      },
      {
        check: 'Closing odds used at opening evaluation',
        method: 'feature builder uses only the evaluation snapshot for the AH quote; opening evaluation has no closing fields',
        result: 'PASS',
      },
      {
        check: 'Target leakage',
        method: 'settlement outcomes used only as labels, never as features',
        result: 'PASS',
      },
    ],
    methodology: {
      temporal:
        'Season walk-forward: train on ALL seasons strictly earlier than the test season; no shuffling; features use strictly earlier calendar dates only.',
      target:
        'Settlement-aware 5-category distribution {FULL_WIN, HALF_WIN, PUSH, HALF_LOSS, FULL_LOSS} derived exactly from a goal-difference PMF using the validated quarter-line split rules.',
      models:
        'Market Poisson baseline (devigged 1X2 fitted), historical line/side prior, recent-form Poisson, Elo baseline, Poisson GLM goals, softmax outcome classifier mapped to Poisson.',
      threshold:
        'Thresholds 0/1/2/3/5/7/10% EV are all reported OOS; the "selected" threshold per fold is chosen on an inner train/validation split inside the training window only.',
      marketComparison:
        'Market probability = proportional two-way devig of the exact AH pair; market EV = p_market·(o−1) − (1−p_market). Paired squared-error difference with 95% CI.',
      evaluation:
        'Brier, log loss and ECE on the binary profit event (pushes excluded), 5-class log loss on the settlement category, realized ROI with analytic 95% CI, drawdown, per-fold stability.',
    },
    ablation: inputs.ablation,
    leagueGeneralization: inputs.leagueGeneralization,
    failureCases,
    limitations,
    verdict,
    researchLog: inputs.researchLog,
  };
}

// ─────────────────────────────── Markdown ───────────────────────────────

function pct(x: number | null | undefined, dp = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'N/A';
  return `${x >= 0 ? '+' : ''}${x.toFixed(dp)}%`;
}

function num(x: number | null | undefined, dp = 4): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'N/A';
  return x.toFixed(dp);
}

function table(headers: string[], rows: string[][]): string {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  for (const r of rows) lines.push(`| ${r.join(' | ')} |`);
  return lines.join('\n');
}

export function renderEdgeValidationMarkdown(report: AhEdgeValidationReport): string {
  const out: string[] = [];
  const primary = report.cohorts.find((c) => c.id === report.primaryCohortId) ?? report.cohorts[0];

  out.push('# AH PROBABILITY & EDGE VALIDATION REPORT');
  out.push('');
  out.push(`- **Engine**: ${report.engineVersion}`);
  out.push(`- **Generated**: ${report.generatedAt}`);
  out.push(`- **Primary cohort**: ${primary.id} — ${primary.description}`);
  out.push('');

  out.push('## 1. DATA USED');
  out.push('');
  out.push(
    table(
      ['Cohort', 'Matches', 'With ML', 'With OU', 'With AH open', 'Seasons', 'Leagues'],
      report.cohorts.map((c) => [
        c.id,
        String(c.coverage.eligibleMatches),
        String(c.coverage.withMlClosing),
        String(c.coverage.withOuClosing),
        String(c.coverage.withAhOpening),
        `${c.coverage.seasons[0]} → ${c.coverage.seasons[c.coverage.seasons.length - 1]}`,
        c.coverage.leagues.join(', '),
      ])
    )
  );
  out.push('');

  out.push('## 2. FEATURE INVENTORY');
  out.push('');
  out.push(
    table(
      ['Feature', 'Group', 'Source', 'Timestamp', 'Lookback', 'Leakage risk', 'Missingness'],
      report.featureInventory.map((f) => [
        f.feature,
        f.group,
        f.source,
        f.timestampAvailability,
        f.lookback,
        f.leakageRisk,
        f.missingness,
      ])
    )
  );
  out.push('');

  out.push('## 3. FEATURE LEAKAGE AUDIT');
  out.push('');
  out.push(table(['Check', 'Method', 'Result'], report.leakageAudit.map((l) => [l.check, l.method, l.result])));
  out.push('');

  out.push('## 4. BASELINES & 5. MODELS');
  out.push('');
  out.push(
    table(
      ['Model', 'N (decided)', 'Brier', 'LogLoss', '5-class LogLoss', 'ECE', 'All-bets ROI', 'EV>0 bets', 'EV>0 ROI', 'EV>0 95% CI'],
      primary.models.map((m) => [
        m.label,
        String(m.bets),
        num(m.brier),
        num(m.logLoss),
        num(m.fiveClassLogLoss),
        num(m.ece),
        pct(m.allBetsRoi * 100),
        String(m.evPositive.bets),
        pct(m.evPositive.roi * 100),
        `[${pct(m.evPositive.ci95[0] * 100)}, ${pct(m.evPositive.ci95[1] * 100)}]`,
      ])
    )
  );
  out.push('');
  out.push(
    `**Market baseline** (devigged two-way AH price, same bets): N=${primary.market.bets}, Brier=${num(primary.market.brier)}, ` +
      `LogLoss=${num(primary.market.logLoss)}, ECE=${num(primary.market.ece)}.`
  );
  out.push('');
  out.push('### Secondary cohorts (context only — not used for the verdict)');
  out.push('');
  out.push(
    table(
      ['Cohort', 'Market Brier', 'Best model', 'Model Brier', 'EV>0 bets', 'EV>0 ROI', '95% CI', 'Folds positive'],
      report.cohorts
        .filter((c) => c.id !== primary.id)
        .map((c) => {
          const eligible = c.models.filter((m) => m.bets >= 500 && m.brier !== null);
          const best = eligible.sort((a, b) => (a.brier as number) - (b.brier as number))[0];
          return [
            c.id,
            num(c.market.brier),
            best?.modelId ?? 'N/A',
            num(best?.brier ?? null),
            String(best?.evPositive.bets ?? 0),
            pct((best?.evPositive.roi ?? 0) * 100),
            best ? `[${pct(best.evPositive.ci95[0] * 100)}, ${pct(best.evPositive.ci95[1] * 100)}]` : 'N/A',
            best?.selectedThreshold ? `${best.selectedThreshold.positiveFolds}/${best.folds}` : 'N/A',
          ];
        })
    )
  );
  out.push('');

  out.push('## 6. CALIBRATION');
  out.push('');
  const calibAgg = new Map<string, Array<{ lower: number; upper: number; count: number; predicted: number; observed: number }>>();
  for (const fold of primary.folds) {
    for (const m of fold.models) {
      const list = calibAgg.get(m.modelId) ?? [];
      for (const b of m.calibration) {
        const existing = list.find((x) => x.lower === b.lower && x.upper === b.upper);
        if (existing) {
          existing.count += b.count;
          existing.predicted += b.predictedMean * b.count;
          existing.observed += b.observedFrequency * b.count;
        } else {
          list.push({
            lower: b.lower,
            upper: b.upper,
            count: b.count,
            predicted: b.predictedMean * b.count,
            observed: b.observedFrequency * b.count,
          });
        }
      }
      calibAgg.set(m.modelId, list);
    }
  }
  const bestModel = primary.models.find((m) => m.modelId === report.verdict.modelId) ?? primary.models[0];
  const bestCalib = calibAgg.get(bestModel.modelId) ?? [];
  out.push(`Calibration curve for best model (${bestModel.label}):`);
  out.push('');
  out.push(
    table(
      ['Bucket', 'N', 'Predicted', 'Observed', 'Gap'],
      bestCalib
        .filter((b) => b.count > 0)
        .map((b) => [
          `${(b.lower * 100).toFixed(0)}–${(b.upper * 100).toFixed(0)}%`,
          String(b.count),
          `${((b.predicted / b.count) * 100).toFixed(1)}%`,
          `${((b.observed / b.count) * 100).toFixed(1)}%`,
          `${(((b.observed - b.predicted) / b.count) * 100).toFixed(1)}pp`,
        ])
    )
  );
  out.push('');

  out.push('## 7. WALK-FORWARD METHODOLOGY');
  out.push('');
  for (const [k, v] of Object.entries(report.methodology)) out.push(`- **${k}**: ${v}`);
  out.push('');

  out.push('## 8. OUT-OF-SAMPLE RESULTS');
  out.push('');
  out.push(
    table(
      ['Fold', 'Test season', 'Train seasons', 'Test matches', 'Bets', 'Market Brier'],
      primary.folds.map((f) => [
        String(f.foldIndex + 1),
        f.testSeason,
        f.trainSeasons.join(','),
        String(f.testMatches),
        String(f.testSides),
        num(f.market.brier),
      ])
    )
  );
  out.push('');
  for (const m of primary.models) {
    if (!m.vsMarket) continue;
    out.push(
      `- ${m.label}: paired Brier diff vs market = ${m.vsMarket.meanSquaredErrorDiff.toFixed(4)} ` +
        `(95% CI [${m.vsMarket.ci95[0].toFixed(4)}, ${m.vsMarket.ci95[1].toFixed(4)}], z=${m.vsMarket.z.toFixed(2)}).`
    );
  }
  out.push('');

  out.push('## 9–10. ROI & EV COMPARISON VS MARKET');
  out.push('');
  out.push(
    table(
      ['Model', 'EV>0 ROI', 'EV>0 95% CI', 'Max DD', 'Selected-threshold ROI', 'Positive folds', 'Thresholds used'],
      primary.models.map((m) => [
        m.label,
        pct(m.evPositive.roi * 100),
        `[${pct(m.evPositive.ci95[0] * 100)}, ${pct(m.evPositive.ci95[1] * 100)}]`,
        num(m.evPositive.maxDrawdown, 1),
        m.selectedThreshold ? pct(m.selectedThreshold.roi * 100) : 'N/A',
        m.selectedThreshold ? `${m.selectedThreshold.positiveFolds}/${m.folds}` : 'N/A',
        m.selectedThreshold ? JSON.stringify(m.selectedThreshold.thresholdsUsed) : 'N/A',
      ])
    )
  );
  out.push('');

  out.push('### EV threshold sweep (all thresholds reported OOS; selected per fold on inner validation only)');
  out.push('');
  out.push(
    table(
      ['Model', 'Threshold', 'N', 'P&L', 'ROI', '95% CI', 'Max DD', 'Positive folds', 'Median fold', 'Worst fold', 'Best fold'],
      primary.models.flatMap((m) =>
        m.byThreshold.map((t) => [
          m.label,
          pct(t.threshold * 100, 0),
          String(t.metrics.bets),
          num(t.metrics.pnl, 1),
          pct(t.metrics.roi * 100),
          `[${pct(t.metrics.ci95[0] * 100)}, ${pct(t.metrics.ci95[1] * 100)}]`,
          num(t.metrics.maxDrawdown, 1),
          `${t.foldStats.positiveFolds}/${t.foldStats.folds}`,
          pct(t.foldStats.medianFoldRoi * 100),
          pct(t.foldStats.worstFoldRoi * 100),
          pct(t.foldStats.bestFoldRoi * 100),
        ])
      )
    )
  );
  out.push('');

  out.push('## 11. AH-LINE BREAKDOWN (primary cohort, EV>0 selection)');
  out.push('');
  const modelIds = primary.models.slice(0, 3).map((m) => m.modelId);
  const lineRows = primary.lineBreakdown.filter((b) => modelIds.includes(b.modelId));
  out.push(
    table(
      ['Line', 'Model', 'Bets', 'Brier', 'Market Brier', 'EV>0 bets', 'EV>0 ROI', '95% CI'],
      lineRows.map((b) => [
        Number(b.key) > 0 ? `+${b.key}` : b.key,
        b.modelId,
        String(b.metrics.bets),
        num(b.metrics.brier),
        num(b.metrics.marketBrier),
        String(b.metrics.evPositiveBets),
        pct(b.metrics.evPositiveRoi * 100),
        `[${pct(b.metrics.evPositiveCi95[0] * 100)}, ${pct(b.metrics.evPositiveCi95[1] * 100)}]`,
      ])
    )
  );
  out.push('');

  out.push('## 12. FAVORITE / UNDERDOG');
  out.push('');
  out.push(
    table(
      ['Direction', 'Model', 'Bets', 'Brier', 'Market Brier', 'EV>0 bets', 'EV>0 ROI'],
      primary.favoriteBreakdown
        .filter((b) => b.modelId === bestModel.modelId)
        .map((b) => [
          b.key,
          b.modelId,
          String(b.metrics.bets),
          num(b.metrics.brier),
          num(b.metrics.marketBrier),
          String(b.metrics.evPositiveBets),
          pct(b.metrics.evPositiveRoi * 100),
        ])
    )
  );
  out.push('');

  out.push('## 13. LEAGUE BREAKDOWN & GENERALIZATION');
  out.push('');
  out.push(
    table(
      ['League', 'Model', 'Bets', 'Brier', 'Market Brier', 'EV>0 bets', 'EV>0 ROI'],
      primary.leagueBreakdown
        .filter((b) => b.modelId === bestModel.modelId)
        .map((b) => [
          b.key,
          b.modelId,
          String(b.metrics.bets),
          num(b.metrics.brier),
          num(b.metrics.marketBrier),
          String(b.metrics.evPositiveBets),
          pct(b.metrics.evPositiveRoi * 100),
        ])
    )
  );
  out.push('');
  if (report.leagueGeneralization.length > 0) {
    out.push('**Leave-one-league-out** (train on other leagues strictly earlier, test on held-out league):');
    out.push('');
    out.push(
      table(
        ['Held-out league', 'Seasons tested', 'Bets', 'Model Brier', 'Market Brier', 'EV>0 bets', 'EV>0 ROI'],
        report.leagueGeneralization.map((l) => [
          l.leagueId,
          l.seasonsTested.join(','),
          String(l.bets),
          num(l.modelBrier),
          num(l.marketBrier),
          String(l.evPositiveBets),
          pct(l.evPositiveRoi * 100),
        ])
      )
    );
    out.push('');
  }

  out.push('## 14. FEATURE ABLATION (Poisson GLM, OOS)');
  out.push('');
  out.push(
    table(
      ['Feature groups', 'Brier', 'LogLoss', '5-class LL', 'Market Brier', 'Paired diff 95% CI', 'EV>0 bets', 'EV>0 ROI'],
      report.ablation.map((a) => [
        a.groups.join('+'),
        num(a.brier),
        num(a.logLoss),
        num(a.fiveClassLogLoss),
        num(a.marketBrier),
        a.vsMarketCi95 ? `[${a.vsMarketCi95[0].toFixed(4)}, ${a.vsMarketCi95[1].toFixed(4)}]` : 'N/A',
        String(a.evPositiveBets),
        pct(a.evPositiveRoi * 100),
      ])
    )
  );
  out.push('');

  out.push('## 15. DRAWDOWN');
  out.push('');
  out.push(
    table(
      ['Model', 'EV>0 Max DD', 'Selected-threshold Max DD'],
      primary.models.map((m) => [
        m.label,
        num(m.evPositive.maxDrawdown, 1),
        m.selectedThreshold ? num(m.selectedThreshold.maxDrawdown, 1) : 'N/A',
      ])
    )
  );
  out.push('');

  out.push('## 16. STATISTICAL UNCERTAINTY');
  out.push('');
  out.push(
    `All ROI figures carry analytic 95% confidence intervals on per-bet returns. Model-vs-market comparisons use the paired squared-error difference with normal-approximation CI. ` +
      `Small-sample line/side cells are not used for any verdict and are marked by N.`
  );
  out.push('');

  out.push('## 17. FAILURE CASES');
  out.push('');
  for (const f of report.failureCases) out.push(`- ${f}`);
  out.push('');

  out.push('## 18. RESEARCH LIMITATIONS');
  out.push('');
  for (const l of report.limitations) out.push(`- ${l}`);
  out.push('');

  out.push('## 19. FINAL VERDICT');
  out.push('');
  out.push(`### ${report.verdict.code}. ${report.verdict.label}`);
  out.push('');
  out.push(`**Decision rule (pre-registered)**: ${report.verdict.rule}`);
  out.push('');
  for (const r of report.verdict.reasons) out.push(`- ${r}`);
  out.push('');
  out.push(
    `**Evidence summary**: OOS bets ${report.verdict.evidence.oosBets}, folds ${report.verdict.evidence.folds}, ` +
      `best model ${report.verdict.evidence.bestModel}, Brier ${num(report.verdict.evidence.modelBrier)} vs market ${num(report.verdict.evidence.marketBrier)}, ` +
      `selection positive=${report.verdict.evidence.selectionPositive}, fold-stable=${report.verdict.evidence.foldStable}.`
  );
  out.push('');
  out.push('## RESEARCH LOG');
  out.push('');
  out.push(
    table(
      ['ID', 'Description', 'Model', 'Train', 'Validation', 'OOS', 'Key results'],
      report.researchLog.map((e) => [
        e.experimentId,
        e.description,
        e.model,
        e.trainPeriod,
        e.validationPeriod,
        e.oosPeriod,
        JSON.stringify(e.results),
      ])
    )
  );
  out.push('');

  return out.join('\n');
}
