// AH YIELD ENGINE — View model for the research dashboard.
// Pure mapping from the full validation report to a compact, UI-safe payload.
// The dashboard never fabricates numbers: a missing report renders an explicit
// DATA NOT AVAILABLE state.

import * as fs from 'fs';
import * as path from 'path';
import type { AhEngineValidationReport } from './ahEngine';
import type { AhValueRow } from './ahAggregation';
import type { AhYieldMetrics } from './ahTypes';

export interface AhCohortView {
  cohortKey: string;
  provenance: string;
  snapshot: string;
  bets: number;
  matches: number;
  leagues: number;
  seasons: string[];
  sampleStart: string;
  sampleEnd: string;
  metrics: AhYieldMetrics;
  valueStateCounts: Record<string, number>;
  valueRows: AhValueRow[];
}

export interface AhResearchViewModel {
  generatedAt: string;
  engineVersion: string;
  quality: {
    canonicalMatches: number;
    resultVerified: number;
    resultCoveragePct: number;
    ahOddsRows: number;
    canonicalJoinPct: number;
    unmatchedRows: number;
    coverageMatches: number;
    coveragePct: number;
    validObservations: number;
    duplicates: number;
    missingPriceRows: number;
    invalidLineRows: number;
    timestampsAvailable: boolean;
    timestampsNote: string;
    integrityFlags: string[];
    bySeason: Record<string, { rawRows: number; matches: number; coveragePct: number }>;
    byLeague: Record<string, { rawRows: number; matches: number; coveragePct: number }>;
  };
  cohorts: AhCohortView[];
  headlineCohortKey: string;
  headlineSelectionReason: string;
  bestCards: AhEngineValidationReport['bestCards'];
  walkForward: Array<{
    cohortKey: string;
    skipped?: string;
    testBets?: number;
    allBetsYieldPct?: number | null;
    positiveEvBets?: number;
    positiveEvYieldPct?: number | null;
    meanBrier?: number | null;
    meanEce?: number | null;
    foldsWithPositiveValue?: number;
    foldsCount?: number;
    temporalIntegrityFailures?: number;
  }>;
  limitations: string[];
  methodology: Record<string, string>;
}

export const AH_RESEARCH_REPORT_PATH = path.join(
  process.cwd(),
  'data',
  'verification',
  'AH_YIELD_ENGINE_REPORT.json'
);

export function buildAhResearchViewModel(report: AhEngineValidationReport): AhResearchViewModel {
  return {
    generatedAt: report.generatedAt,
    engineVersion: report.engineVersion,
    quality: {
      canonicalMatches: report.dataQuality.matches.total,
      resultVerified: report.dataQuality.matches.resultVerified,
      resultCoveragePct: report.dataQuality.matches.resultCoveragePct,
      ahOddsRows: report.dataQuality.ahOdds.rawRows,
      canonicalJoinPct: report.dataQuality.ahOdds.canonicalJoinPct,
      unmatchedRows: report.dataQuality.ahOdds.unmatchedRows,
      coverageMatches: report.dataQuality.ahOdds.coverageMatches,
      coveragePct: report.dataQuality.ahOdds.coveragePct,
      validObservations: report.dataQuality.ahOdds.validObservations,
      duplicates: report.dataQuality.ahOdds.duplicates,
      missingPriceRows: report.dataQuality.ahOdds.missingPriceRows,
      invalidLineRows: report.dataQuality.ahOdds.invalidLineRows,
      timestampsAvailable: report.dataQuality.ahOdds.timestampsAvailable,
      timestampsNote: report.dataQuality.ahOdds.timestampsNote,
      integrityFlags: report.dataQuality.integrityFlags,
      bySeason: report.dataQuality.ahOdds.bySeason,
      byLeague: report.dataQuality.ahOdds.byLeague,
    },
    cohorts: report.cohorts.map((c) => ({
      cohortKey: c.cohortKey,
      provenance: c.provenance,
      snapshot: c.snapshot,
      bets: c.bets,
      matches: c.matches,
      leagues: c.leagues,
      seasons: c.seasons,
      sampleStart: c.sampleStart,
      sampleEnd: c.sampleEnd,
      metrics: c.metrics,
      valueStateCounts: c.valueStateCounts,
      valueRows: c.valueRows,
    })),
    headlineCohortKey: report.headlineCohortKey,
    headlineSelectionReason: report.headlineSelectionReason,
    bestCards: report.bestCards,
    walkForward: Object.entries(report.walkForward).map(([cohortKey, value]) => {
      if ('skipped' in value) return { cohortKey, skipped: value.skipped };
      return {
        cohortKey,
        testBets: value.aggregate.testBets,
        allBetsYieldPct: value.aggregate.allBetsYieldPct,
        positiveEvBets: value.aggregate.positiveEvBets,
        positiveEvYieldPct: value.aggregate.positiveEvYieldPct,
        meanBrier: value.aggregate.meanBrier,
        meanEce: value.aggregate.meanEce,
        foldsWithPositiveValue: value.aggregate.foldsWithPositiveValue,
        foldsCount: value.aggregate.foldsCount,
        temporalIntegrityFailures: value.folds.filter((f) => !f.temporalIntegrityOk).length,
      };
    }),
    limitations: report.limitations,
    methodology: report.methodology,
  };
}

export function loadAhResearchViewModel(filePath: string = AH_RESEARCH_REPORT_PATH): AhResearchViewModel | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AhEngineValidationReport;
  return buildAhResearchViewModel(raw);
}
