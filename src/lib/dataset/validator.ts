/**
 * HandicapLab Dataset Validator
 * ==============================
 * Validates a complete CanonicalDataset for structural integrity,
 * referential consistency, and data quality.
 *
 * Checks:
 *   - Duplicate fixture IDs
 *   - Missing results for finished fixtures
 *   - Missing odds
 *   - Invalid kickoff dates
 *   - Invalid odds (probabilities where odds <= 0)
 *   - Invalid scores (negative goals)
 *   - Orphan team references
 *   - Orphan competition references
 *   - Fixture/odds mismatches
 */

import { CanonicalDataset, CanonicalTeam, CanonicalCompetition, DatasetValidationReport, DatasetValidationError } from './types';
import crypto from 'crypto';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export class DatasetValidator {
  validate(
    dataset: CanonicalDataset,
    teams?: CanonicalTeam[],
    competitions?: CanonicalCompetition[]
  ): DatasetValidationReport {
    const errors: DatasetValidationError[] = [];
    const warnings: DatasetValidationError[] = [];
    const seenFixtureIds = new Set<string>();
    let duplicateFixtures = 0;
    let missingResults = 0;
    let missingOdds = 0;

    const teamIds = new Set((teams || dataset.teams).map((t) => t.id));
    const compIds = new Set((competitions || dataset.competitions).map((c) => c.id));

    for (const match of dataset.matches) {
      const f = match.fixture;

      // Duplicate fixture check
      if (seenFixtureIds.has(f.id)) {
        duplicateFixtures++;
        errors.push({ fixtureId: f.id, field: 'fixture.id', message: 'Duplicate fixture ID', severity: 'error' });
      }
      seenFixtureIds.add(f.id);

      // Missing kickoff or invalid date
      if (!f.kickoff) {
        errors.push({ fixtureId: f.id, field: 'kickoff', message: 'Missing kickoff date', severity: 'error' });
      } else if (!ISO_DATE_RE.test(f.kickoff)) {
        errors.push({ fixtureId: f.id, field: 'kickoff', message: `Invalid kickoff date: ${f.kickoff}`, severity: 'error' });
      }

      // Team reference check
      if (!teamIds.has(f.homeTeamId)) {
        errors.push({ fixtureId: f.id, field: 'homeTeamId', message: `Orphan home team: ${f.homeTeamId}`, severity: 'error' });
      }
      if (!teamIds.has(f.awayTeamId)) {
        errors.push({ fixtureId: f.id, field: 'awayTeamId', message: `Orphan away team: ${f.awayTeamId}`, severity: 'error' });
      }

      // Competition reference check
      if (!compIds.has(f.competitionId)) {
        warnings.push({ fixtureId: f.id, field: 'competitionId', message: `Orphan competition: ${f.competitionId}`, severity: 'warning' });
      }

      // Odds checks
      if (match.odds.length === 0) {
        missingOdds++;
        warnings.push({ fixtureId: f.id, field: 'odds', message: 'No odds data', severity: 'warning' });
      }
      for (const odds of match.odds) {
        if (odds.homeOdds <= 0) {
          errors.push({ fixtureId: f.id, field: 'odds.homeOdds', message: `Invalid home odds: ${odds.homeOdds}`, severity: 'error' });
        }
        if (odds.awayOdds <= 0) {
          errors.push({ fixtureId: f.id, field: 'odds.awayOdds', message: `Invalid away odds: ${odds.awayOdds}`, severity: 'error' });
        }
      }

      // Result checks
      if (match.result) {
        if (match.result.homeGoals < 0) {
          errors.push({ fixtureId: f.id, field: 'result.homeGoals', message: `Negative home goals: ${match.result.homeGoals}`, severity: 'error' });
        }
        if (match.result.awayGoals < 0) {
          errors.push({ fixtureId: f.id, field: 'result.awayGoals', message: `Negative away goals: ${match.result.awayGoals}`, severity: 'error' });
        }
      } else if (f.status === 'finished') {
        missingResults++;
        warnings.push({ fixtureId: f.id, field: 'result', message: 'Finished fixture missing result', severity: 'warning' });
      }
    }

    const totalFixtures = dataset.matches.length;
    const invalidFixtures = errors.filter((e) => e.severity === 'error').length;
    const validFixtures = totalFixtures - new Set(errors.filter((e) => e.severity === 'error').map((e) => e.fixtureId)).size;

    return {
      datasetId: dataset.manifest.id,
      valid: errors.filter((e) => e.severity === 'error').length === 0,
      totalFixtures,
      validFixtures: Math.max(0, validFixtures),
      invalidFixtures,
      errors: errors.filter((e) => e.severity === 'error'),
      warnings: [...warnings, ...errors.filter((e) => e.severity === 'warning')],
      duplicateFixtures,
      missingResults,
      missingOdds,
    };
  }

  generateFingerprint(dataset: CanonicalDataset): string {
    const data = {
      matches: dataset.matches,
      teams: dataset.teams,
      competitions: dataset.competitions,
    };
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}