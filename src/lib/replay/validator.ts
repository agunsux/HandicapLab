/**
 * HandicapLab Replay Validator
 * =============================
 * Validates historical match data before replay execution.
 *
 * Detects:
 *   - Missing fixtures
 *   - Missing odds
 *   - Invalid dates
 *   - Invalid scores
 *   - Schema mismatches
 *
 * No production code is modified.
 */

import { HistoricalMatch, ReplayContext, ReplayValidationReport, ReplayValidationError } from './types';

export function validateDataset(matches: HistoricalMatch[], context: ReplayContext): ReplayValidationReport {
  const errors: ReplayValidationError[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const match of matches) {
    const fixtureErrors = validateMatch(match);
    if (fixtureErrors.length > 0) {
      invalidCount++;
      errors.push(...fixtureErrors);
    } else {
      validCount++;
    }
  }

  const missingOdds = matches.filter((m) => m.odds.length === 0).length;
  const missingResults = matches.filter((m) => !m.result).length;

  return {
    totalFixtures: matches.length,
    validFixtures: validCount,
    invalidFixtures: invalidCount,
    missingOdds,
    missingResults,
    validationErrors: errors,
  };
}

function validateMatch(match: HistoricalMatch): ReplayValidationError[] {
  const errors: ReplayValidationError[] = [];
  const f = match.fixture;

  if (!f.id) {
    errors.push({ fixtureId: 'unknown', field: 'id', message: 'Missing fixture ID', severity: 'error' });
    return errors;
  }

  if (!f.homeTeam) {
    errors.push({ fixtureId: f.id, field: 'homeTeam', message: 'Missing home team', severity: 'error' });
  }
  if (!f.awayTeam) {
    errors.push({ fixtureId: f.id, field: 'awayTeam', message: 'Missing away team', severity: 'error' });
  }
  if (!f.kickoff) {
    errors.push({ fixtureId: f.id, field: 'kickoff', message: 'Missing kickoff date', severity: 'error' });
  } else if (isNaN(Date.parse(f.kickoff))) {
    errors.push({ fixtureId: f.id, field: 'kickoff', message: `Invalid kickoff date: ${f.kickoff}`, severity: 'error' });
  }
  if (!f.leagueId) {
    errors.push({ fixtureId: f.id, field: 'leagueId', message: 'Missing league ID', severity: 'error' });
  }

  if (match.result) {
    if (typeof match.result.homeGoals !== 'number' || match.result.homeGoals < 0) {
      errors.push({ fixtureId: f.id, field: 'homeGoals', message: `Invalid home goals: ${match.result.homeGoals}`, severity: 'error' });
    }
    if (typeof match.result.awayGoals !== 'number' || match.result.awayGoals < 0) {
      errors.push({ fixtureId: f.id, field: 'awayGoals', message: `Invalid away goals: ${match.result.awayGoals}`, severity: 'error' });
    }
  }

  return errors;
}