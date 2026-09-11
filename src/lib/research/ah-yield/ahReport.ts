// AH YIELD ENGINE — Markdown validation report renderer.

import type { AhCohortReport, AhEngineValidationReport } from './ahEngine';
import type { AhValueRow } from './ahAggregation';

function pct(x: number, dp = 2): string {
  return `${x >= 0 ? '+' : ''}${x.toFixed(dp)}%`;
}

function num(x: number | null, dp = 2): string {
  return x === null || !Number.isFinite(x) ? 'N/A' : x.toFixed(dp);
}

function table(headers: string[], rows: string[][]): string {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  for (const r of rows) lines.push(`| ${r.join(' | ')} |`);
  return lines.join('\n');
}

function valueRowsTable(rows: AhValueRow[], limit: number): string {
  const eligible = rows.filter((r) => r.eligibleForBest).slice(0, limit);
  const source = eligible.length > 0 ? eligible : rows.slice(0, limit);
  return table(
    ['AH Line', 'Side', 'Bets', 'HitRate', 'AvgOdds', 'P&L', 'Yield%', 'ROI 95% CI', 'Model P(profit)', 'FairOdds', 'ModelEV', 'Edge', 'Sample', 'State'],
    source.map((r) => [
      r.line > 0 ? `+${r.line}` : String(r.line),
      r.side,
      String(r.evaluatedBets),
      `${(r.weightedHitRate * 100).toFixed(1)}%`,
      num(r.averageOdds, 3),
      num(r.totalPnl, 2),
      pct(r.yieldPct),
      `[${pct(r.roiCi95[0] * 100)}, ${pct(r.roiCi95[1] * 100)}]`,
      `${(r.modelProbability * 100).toFixed(1)}%`,
      r.fairOdds === null ? 'N/A' : num(r.fairOdds, 3),
      pct(r.modelEvMean * 100),
      r.edgeMean === null ? 'N/A' : pct(r.edgeMean * 100),
      r.sampleSizeStatus,
      r.valueState,
    ])
  );
}

function cohortSection(cohort: AhCohortReport, detailed: boolean): string {
  const m = cohort.metrics;
  const lines: string[] = [];
  lines.push(`### Cohort: ${cohort.provenance} / ${cohort.snapshot}`);
  lines.push('');
  lines.push(
    table(
      ['Bets', 'Matches', 'Leagues', 'Seasons', 'Sample', 'FullW', 'HalfW', 'Push', 'HalfL', 'FullL'],
      [
        [
          String(m.evaluatedBets),
          String(cohort.matches),
          String(cohort.leagues),
          String(cohort.seasons.length),
          `${cohort.sampleStart} → ${cohort.sampleEnd}`,
          String(m.fullWins),
          String(m.halfWins),
          String(m.pushes),
          String(m.halfLosses),
          String(m.fullLosses),
        ],
      ]
    )
  );
  lines.push('');
  lines.push(
    table(
      ['Total Stake', 'Total P&L', 'Yield%', 'ROI 95% CI', 'HitRate (weighted)', 'Avg Odds', 'Max DD', 'Worst Streak', 'Profit Factor'],
      [
        [
          num(m.totalStake, 1),
          num(m.totalPnl, 1),
          pct(m.yieldPct),
          `[${pct(m.roiCi95[0] * 100)}, ${pct(m.roiCi95[1] * 100)}]`,
          `${(m.weightedHitRate * 100).toFixed(1)}%`,
          num(m.averageOdds, 3),
          num(m.maxDrawdown, 2),
          String(m.longestLosingStreak),
          num(m.profitFactor, 3),
        ],
      ]
    )
  );
  lines.push('');
  if (detailed) {
    lines.push('#### By line and side (sample-size protected ranking)');
    lines.push('');
    lines.push(valueRowsTable(cohort.valueRows, 40));
    lines.push('');
    lines.push('#### By league');
    lines.push('');
    lines.push(
      table(
        ['League', 'Bets', 'P&L', 'Yield%', 'ROI 95% CI', 'Sample'],
        cohort.breakdowns.league.map((r) => [
          r.key,
          String(r.evaluatedBets),
          num(r.totalPnl, 2),
          pct(r.yieldPct),
          `[${pct(r.roiCi95[0] * 100)}, ${pct(r.roiCi95[1] * 100)}]`,
          r.sampleSizeStatus,
        ])
      )
    );
    lines.push('');
    lines.push('#### By season');
    lines.push('');
    lines.push(
      table(
        ['Season', 'Bets', 'P&L', 'Yield%', 'ROI 95% CI', 'Sample'],
        cohort.breakdowns.season.map((r) => [
          r.key,
          String(r.evaluatedBets),
          num(r.totalPnl, 2),
          pct(r.yieldPct),
          `[${pct(r.roiCi95[0] * 100)}, ${pct(r.roiCi95[1] * 100)}]`,
          r.sampleSizeStatus,
        ])
      )
    );
    lines.push('');
    lines.push('#### By favorite / underdog');
    lines.push('');
    lines.push(
      table(
        ['Direction', 'Bets', 'P&L', 'Yield%', 'ROI 95% CI', 'Sample'],
        cohort.breakdowns.favoriteStatus.map((r) => [
          r.key,
          String(r.evaluatedBets),
          num(r.totalPnl, 2),
          pct(r.yieldPct),
          `[${pct(r.roiCi95[0] * 100)}, ${pct(r.roiCi95[1] * 100)}]`,
          r.sampleSizeStatus,
        ])
      )
    );
    lines.push('');
    lines.push('#### By side');
    lines.push('');
    lines.push(
      table(
        ['Side', 'Bets', 'P&L', 'Yield%', 'ROI 95% CI', 'Sample'],
        cohort.breakdowns.side.map((r) => [
          r.key,
          String(r.evaluatedBets),
          num(r.totalPnl, 2),
          pct(r.yieldPct),
          `[${pct(r.roiCi95[0] * 100)}, ${pct(r.roiCi95[1] * 100)}]`,
          r.sampleSizeStatus,
        ])
      )
    );
  }
  return lines.join('\n');
}

export function renderAhValidationMarkdown(report: AhEngineValidationReport): string {
  const out: string[] = [];
  out.push('# AH ENGINE VALIDATION REPORT');
  out.push('');
  out.push(`- **Engine**: ${report.engineVersion}`);
  out.push(`- **Generated**: ${report.generatedAt}`);
  out.push(`- **Canonical matches**: ${report.datasetVersion.canonicalMatches.toLocaleString('en-US')}`);
  out.push(`- **Market odds rows**: ${report.datasetVersion.oddsRows.toLocaleString('en-US')} (AH: ${report.datasetVersion.ahOddsRows.toLocaleString('en-US')})`);
  out.push('');

  out.push('## DATA');
  out.push('');
  const q = report.dataQuality;
  out.push(
    table(
      ['Metric', 'Value'],
      [
        ['Canonical matches', q.matches.total.toLocaleString('en-US')],
        ['Result verified', `${q.matches.resultVerified.toLocaleString('en-US')} (${q.matches.resultCoveragePct.toFixed(2)}%)`],
        ['Duplicate canonical ids', String(q.matches.duplicateCanonicalIds)],
        ['AH odds rows', q.ahOdds.rawRows.toLocaleString('en-US')],
        ['Canonical join rate (odds rows)', `${q.ahOdds.canonicalJoinPct.toFixed(2)}%`],
        ['Unmatched odds rows', String(q.ahOdds.unmatchedRows)],
        ['AH match coverage', `${q.ahOdds.coverageMatches.toLocaleString('en-US')} / ${q.matches.total.toLocaleString('en-US')} (${q.ahOdds.coveragePct.toFixed(2)}%)`],
        ['Valid observations (1-unit bets)', q.ahOdds.validObservations.toLocaleString('en-US')],
        ['Duplicates collapsed', String(q.ahOdds.duplicates)],
        ['Missing price rows', String(q.ahOdds.missingPriceRows)],
        ['Invalid line rows', String(q.ahOdds.invalidLineRows)],
        ['Odds timestamps available', 'NO — match_date + snapshot label only'],
      ]
    )
  );
  out.push('');
  out.push('**Integrity flags**: ' + (q.integrityFlags.length > 0 ? q.integrityFlags.join(', ') : 'none'));
  out.push('');
  out.push('### Provenance layouts (resolved from source CSV headers)');
  out.push('');
  out.push(
    table(
      ['Source file', 'Open branch', 'Close branch', 'AH rows'],
      q.provenanceLayouts.map((l) => [
        l.sourceFile.split(/[\\/]/).slice(-1)[0],
        l.openBranch,
        l.closeBranch,
        String(l.rows),
      ])
    )
  );
  out.push('');
  out.push('### Coverage by season (valid AH matches)');
  out.push('');
  out.push(
    table(
      ['Season', 'AH rows', 'Matches', 'Coverage'],
      Object.entries(q.ahOdds.bySeason).map(([season, s]) => [
        season,
        String(s.rawRows),
        String(s.matches),
        `${s.coveragePct.toFixed(1)}%`,
      ])
    )
  );
  out.push('');

  out.push('## SETTLEMENT');
  out.push('');
  out.push(
    `Independent brute-force invariants: **${report.settlementSelfCheck.passed}/${report.settlementSelfCheck.checked} passed**, ` +
      `${report.settlementSelfCheck.failed} failed. Unit suite: see \`tests/ah-yield/\`.`
  );
  if (report.settlementSelfCheck.failures.length > 0) {
    out.push('');
    out.push('Failures:');
    for (const f of report.settlementSelfCheck.failures) out.push(`- ${f}`);
  }
  out.push('');

  out.push('## YIELD / ROI');
  out.push('');
  out.push(
    table(
      ['Cohort (provenance/snapshot)', 'Bets', 'Stake', 'P&L', 'Yield%', 'ROI 95% CI', 'Sample'],
      report.cohorts.map((c) => [
        c.cohortKey,
        String(c.metrics.evaluatedBets),
        num(c.metrics.totalStake, 0),
        num(c.metrics.totalPnl, 1),
        pct(c.metrics.yieldPct),
        `[${pct(c.metrics.roiCi95[0] * 100)}, ${pct(c.metrics.roiCi95[1] * 100)}]`,
        c.metrics.sampleSizeStatus,
      ])
    )
  );
  out.push('');
  out.push(`**Headline cohort**: \`${report.headlineCohortKey}\` — ${report.headlineSelectionReason}`);
  out.push('');
  const headline = report.cohorts.find((c) => c.cohortKey === report.headlineCohortKey);
  if (headline) {
    out.push(cohortSection(headline, true));
  } else {
    out.push('DATA NOT AVAILABLE — headline cohort has no observations.');
  }
  out.push('');

  out.push('## BEST CARDS (headline cohort)');
  out.push('');
  out.push(
    table(
      ['Card', 'Available', 'Line', 'Side', 'Bets', 'Yield%', 'Model EV', 'Value State'],
      report.bestCards.map((c) => [
        c.name,
        c.available ? 'YES' : `NO — ${c.reason ?? ''}`,
        c.pick ? (c.pick.line > 0 ? `+${c.pick.line}` : String(c.pick.line)) : '—',
        c.pick?.side ?? '—',
        c.pick ? String(c.pick.evaluatedBets) : '—',
        c.pick ? pct(c.pick.yieldPct) : '—',
        c.pick ? pct(c.pick.modelEvMean * 100) : '—',
        c.pick?.valueState ?? '—',
      ])
    )
  );
  out.push('');

  out.push('## WALK-FORWARD (out-of-sample, season folds)');
  out.push('');
  for (const [key, wf] of Object.entries(report.walkForward)) {
    if ('skipped' in wf) {
      out.push(`- \`${key}\`: SKIPPED — ${wf.skipped}`);
      continue;
    }
    const agg = wf.aggregate;
    out.push(
      `- \`${key}\`: OOS bets ${agg.testBets}, all-bets yield ` +
        `${agg.allBetsYieldPct === null ? 'N/A' : pct(agg.allBetsYieldPct)}, positive-EV selection ` +
        `${agg.positiveEvBets} bets @ ${agg.positiveEvYieldPct === null ? 'N/A' : pct(agg.positiveEvYieldPct)} yield, ` +
        `mean Brier ${num(agg.meanBrier, 4)}, mean ECE ${num(agg.meanEce, 4)}, ` +
        `positive-value folds ${agg.foldsWithPositiveValue}/${agg.foldsCount}.`
    );
    const integrity = wf.folds.filter((f) => !f.temporalIntegrityOk);
    if (integrity.length > 0) out.push(`  - **TEMPORAL INTEGRITY FAILURE** in folds: ${integrity.map((f) => f.testSeason).join(', ')}`);
  }
  out.push('');

  out.push('## BIAS CHECK');
  out.push('');
  const allFolds = Object.values(report.walkForward).flatMap((w) => ('folds' in w ? w.folds : []));
  const integrityFailures = allFolds.filter((f) => !f.temporalIntegrityOk).length;
  out.push(
    table(
      ['Check', 'Result'],
      [
        ['Look-ahead (train max date < test min date)', integrityFailures === 0 ? 'PASS' : `FAIL (${integrityFailures} folds)`],
        ['Duplicate odds collapsed', String(report.dataQuality.ahOdds.duplicates)],
        ['Duplicate canonical ids', String(report.dataQuality.matches.duplicateCanonicalIds)],
        ['Unmatched odds rows', String(report.dataQuality.ahOdds.unmatchedRows)],
        ['Provenance mislabel', report.dataQuality.integrityFlags.some((f) => f.startsWith('PROVENANCE_MISLABEL')) ? 'DETECTED (resolved per-row)' : 'none'],
        ['Survivorship', 'No fixture filtering by outcome; all verified-result matches included'],
      ]
    )
  );
  out.push('');

  out.push('## LIMITATIONS');
  out.push('');
  for (const l of report.limitations) out.push(`- ${l}`);
  out.push('');

  out.push('## METHODOLOGY');
  out.push('');
  for (const [k, v] of Object.entries(report.methodology)) out.push(`- **${k}**: ${v}`);
  out.push('');

  return out.join('\n');
}
