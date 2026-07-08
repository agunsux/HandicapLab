// Data Quality Framework — Validation with Severity Levels
// Location: src/lib/quality/validator.ts

export type Severity = 'FATAL' | 'ERROR' | 'WARNING' | 'INFO';

export interface QualityIssue {
  code: string;
  message: string;
  severity: Severity;
  field?: string;
  value?: any;
  record?: string | number;
}

export interface QualityReport {
  passed: boolean;
  totalChecks: number;
  fatalCount: number;
  errorCount: number;
  warningCount: number;
  issues: QualityIssue[];
  timestamp: string;
}

function createReport(issues: QualityIssue[]): QualityReport {
  return {
    passed: !issues.some(i => i.severity === 'FATAL' || i.severity === 'ERROR'),
    totalChecks: issues.length,
    fatalCount: issues.filter(i => i.severity === 'FATAL').length,
    errorCount: issues.filter(i => i.severity === 'ERROR').length,
    warningCount: issues.filter(i => i.severity === 'WARNING').length,
    issues,
    timestamp: new Date().toISOString(),
  };
}

export function validateOdds(oddsHome: number, oddsDraw: number, oddsAway: number): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (oddsHome <= 1 || oddsDraw <= 1 || oddsAway <= 1)
    issues.push({ code: 'NEGATIVE_ODDS', message: 'Odds must be > 1.0', severity: 'ERROR', field: 'odds' });
  if (isNaN(oddsHome) || isNaN(oddsDraw) || isNaN(oddsAway))
    issues.push({ code: 'INVALID_ODDS', message: 'Odds contain NaN values', severity: 'FATAL', field: 'odds' });
  return issues;
}

export function validateProbability(prob: number, field: string): QualityIssue[] {
  if (prob < 0 || prob > 1) return [{ code: 'INVALID_PROBABILITY', message: `Probability ${field}=${prob} out of [0,1]`, severity: 'FATAL', field }];
  if (isNaN(prob)) return [{ code: 'INVALID_PROBABILITY', message: `Probability ${field} is NaN`, severity: 'FATAL', field }];
  return [];
}

export function validateMissingOdds(odds: (number | null | undefined)[], matchId: string): QualityIssue[] {
  const missingCount = odds.filter(o => o === null || o === undefined).length;
  if (missingCount === 0) return [];
  return [{ code: 'MISSING_ODDS', message: `Match ${matchId}: ${missingCount} missing odds`, severity: missingCount >= 3 ? 'FATAL' : 'WARNING', record: matchId }];
}

export function validateDuplicateOdds(oddsList: Array<{ matchId: string; odds: number[] }>): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const seen = new Map<string, number>();
  for (const entry of oddsList) {
    const key = `${entry.matchId}_${entry.odds.join(',')}`;
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    if (count > 1) issues.push({ code: 'DUPLICATE_ODDS', message: `Duplicate odds for ${entry.matchId}`, severity: 'WARNING', record: entry.matchId });
  }
  return issues;
}

export function validateChronology(dates: Date[]): QualityIssue[] {
  const issues: QualityIssue[] = [];
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) issues.push({ code: 'INVALID_CHRONOLOGY', message: `Match index ${i} has date before previous match`, severity: 'ERROR', record: `index_${i}` });
  }
  return issues;
}

export function validateFutureMatch(kickoff: Date): QualityIssue[] {
  if (kickoff > new Date()) return [{ code: 'FUTURE_MATCH', message: `Kickoff ${kickoff.toISOString()} is in the future`, severity: 'INFO' }];
  return [];
}

export function validateDuplicatePredictions(predictions: Array<{ matchId: string; market: string }>): QualityIssue[] {
  const seen = new Set<string>();
  return predictions.reduce<QualityIssue[]>((issues, p) => {
    const key = `${p.matchId}_${p.market}`;
    if (seen.has(key)) issues.push({ code: 'DUPLICATE_PREDICTION', message: `Duplicate prediction for ${key}`, severity: 'ERROR', record: p.matchId });
    seen.add(key);
    return issues;
  }, []);
}

export function validateDuplicateSettlements(settlements: Array<{ matchId: string; market: string }>): QualityIssue[] {
  const seen = new Set<string>();
  return settlements.reduce<QualityIssue[]>((issues, s) => {
    const key = `${s.matchId}_${s.market}`;
    if (seen.has(key)) issues.push({ code: 'DUPLICATE_SETTLEMENT', message: `Duplicate settlement for ${key}`, severity: 'ERROR', record: s.matchId });
    seen.add(key);
    return issues;
  }, []);
}

export function validateClosingOdds(odds: number | null | undefined, matchId: string): QualityIssue[] {
  if (odds === null || odds === undefined) return [{ code: 'MISSING_CLOSING_ODDS', message: `Match ${matchId}: No closing odds`, severity: 'WARNING', record: matchId }];
  if (odds <= 1) return [{ code: 'INVALID_CLOSING_ODDS', message: `Match ${matchId}: Closing odds ${odds} <= 1.0`, severity: 'ERROR', record: matchId }];
  return [];
}

export function validateBatch(matches: Array<{
  matchId: string; oddsHome: number; oddsDraw: number; oddsAway: number;
  homeProb: number; drawProb: number; awayProb: number;
  closingOdds?: number | null; kickoff?: Date;
}>): QualityReport {
  const allIssues: QualityIssue[] = [];
  const allDates: Date[] = [];
  const oddsEntries: Array<{ matchId: string; odds: number[] }> = [];
  for (const m of matches) {
    allIssues.push(...validateOdds(m.oddsHome, m.oddsDraw, m.oddsAway));
    allIssues.push(...validateProbability(m.homeProb, 'homeProb'));
    allIssues.push(...validateProbability(m.drawProb, 'drawProb'));
    allIssues.push(...validateProbability(m.awayProb, 'awayProb'));
    allIssues.push(...validateMissingOdds([m.oddsHome, m.oddsDraw, m.oddsAway], m.matchId));
    if (m.closingOdds !== undefined) allIssues.push(...validateClosingOdds(m.closingOdds, m.matchId));
    if (m.kickoff) { allIssues.push(...validateFutureMatch(m.kickoff)); allDates.push(m.kickoff); }
    oddsEntries.push({ matchId: m.matchId, odds: [m.oddsHome, m.oddsDraw, m.oddsAway] });
  }
  allIssues.push(...validateChronology(allDates));
  allIssues.push(...validateDuplicateOdds(oddsEntries));
  allIssues.push(...validateDuplicatePredictions(matches.map(m => ({ matchId: m.matchId, market: 'ML' }))));
  return createReport(allIssues);
}
