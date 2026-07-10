/**
 * Sprint A4 — Data Integrity Engine
 * ==================================
 * Deep integrity verification over a CanonicalDataset.
 *
 * Checks (12):
 *   duplicate fixtures, missing IDs, missing kickoff, invalid scores,
 *   invalid odds, negative odds, timezone consistency, chronological
 *   ordering, duplicate matches, missing teams, missing competitions,
 *   missing bookmakers.
 *
 * Produces an IntegrityReport with a numeric integrity score (0–100).
 * The engine is pure: no I/O, deterministic output for identical input.
 */

import type { CanonicalDataset } from '../dataset/types';
import { VALIDATION_VERSION } from './types';
import type { IntegrityCheck, IntegrityIssue, IntegrityReport } from './types';

const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

const ALL_CHECKS: readonly IntegrityCheck[] = [
  'duplicate_fixtures',
  'missing_ids',
  'missing_kickoff',
  'invalid_scores',
  'invalid_odds',
  'negative_odds',
  'timezone_consistency',
  'chronological_ordering',
  'duplicate_matches',
  'missing_teams',
  'missing_competitions',
  'missing_bookmakers',
];

export class IntegrityEngine {
  verify(dataset: CanonicalDataset): IntegrityReport {
    const issues: IntegrityIssue[] = [];
    const teamIds = new Set(dataset.teams.map((t) => t.id));
    const compIds = new Set(dataset.competitions.map((c) => c.id));

    const seenFixtureIds = new Set<string>();
    const matchSignatures = new Set<string>();
    let lastKickoffMs = -Infinity;
    let outOfOrder = false;
    const tzStyles = new Set<string>();

    for (const match of dataset.matches) {
      const f = match.fixture;

      // duplicate_fixtures
      if (seenFixtureIds.has(f.id)) {
        issues.push({ check: 'duplicate_fixtures', severity: 'error', fixtureId: f.id, message: `Duplicate fixture ID: ${f.id}` });
      }
      seenFixtureIds.add(f.id);

      // missing_ids
      if (!f.id) issues.push({ check: 'missing_ids', severity: 'error', fixtureId: null, message: 'Fixture missing id' });
      if (!f.homeTeamId) issues.push({ check: 'missing_ids', severity: 'error', fixtureId: f.id, message: 'Fixture missing homeTeamId' });
      if (!f.awayTeamId) issues.push({ check: 'missing_ids', severity: 'error', fixtureId: f.id, message: 'Fixture missing awayTeamId' });

      // missing_kickoff
      if (!f.kickoff) {
        issues.push({ check: 'missing_kickoff', severity: 'error', fixtureId: f.id, message: 'Missing kickoff' });
      }

      // timezone_consistency
      if (f.kickoff) {
        if (!ISO_WITH_TZ.test(f.kickoff)) {
          issues.push({ check: 'timezone_consistency', severity: 'warning', fixtureId: f.id, message: `Kickoff missing timezone designator: ${f.kickoff}` });
        } else {
          tzStyles.add(f.kickoff.endsWith('Z') ? 'utc' : 'offset');
        }
      }

      // chronological_ordering
      if (f.kickoff) {
        const ms = new Date(f.kickoff).getTime();
        if (Number.isNaN(ms)) {
          issues.push({ check: 'chronological_ordering', severity: 'error', fixtureId: f.id, message: `Unparseable kickoff: ${f.kickoff}` });
        } else {
          if (ms < lastKickoffMs) outOfOrder = true;
          lastKickoffMs = ms;
        }
      }

      // duplicate_matches (logical: same teams + kickoff, different id)
      const signature = `${f.homeTeamId}|${f.awayTeamId}|${f.kickoff}`;
      if (matchSignatures.has(signature)) {
        issues.push({ check: 'duplicate_matches', severity: 'error', fixtureId: f.id, message: `Duplicate logical match: ${signature}` });
      }
      matchSignatures.add(signature);

      // missing_teams
      if (f.homeTeamId && !teamIds.has(f.homeTeamId)) {
        issues.push({ check: 'missing_teams', severity: 'error', fixtureId: f.id, message: `Home team not in registry: ${f.homeTeamId}` });
      }
      if (f.awayTeamId && !teamIds.has(f.awayTeamId)) {
        issues.push({ check: 'missing_teams', severity: 'error', fixtureId: f.id, message: `Away team not in registry: ${f.awayTeamId}` });
      }

      // missing_competitions
      if (f.competitionId && !compIds.has(f.competitionId)) {
        issues.push({ check: 'missing_competitions', severity: 'error', fixtureId: f.id, message: `Competition not in registry: ${f.competitionId}` });
      }

      // odds checks
      for (const o of match.odds) {
        for (const [field, value] of [
          ['homeOdds', o.homeOdds],
          ['awayOdds', o.awayOdds],
          ['drawOdds', o.drawOdds],
        ] as const) {
          if (value === null || value === undefined) continue;
          if (Number.isNaN(value)) {
            issues.push({ check: 'invalid_odds', severity: 'error', fixtureId: f.id, message: `NaN ${field}` });
          } else if (value < 0) {
            issues.push({ check: 'negative_odds', severity: 'error', fixtureId: f.id, message: `Negative ${field}: ${value}` });
          } else if (value === 0 || (value > 0 && value < 1)) {
            issues.push({ check: 'invalid_odds', severity: 'error', fixtureId: f.id, message: `Invalid ${field} (must be >= 1.0): ${value}` });
          }
        }
        // missing_bookmakers
        if (!o.provider) {
          issues.push({ check: 'missing_bookmakers', severity: 'warning', fixtureId: f.id, message: `Odds entry missing bookmaker/provider (${o.market})` });
        }
      }

      // invalid_scores
      if (match.result) {
        const { homeGoals, awayGoals } = match.result;
        if (Number.isNaN(homeGoals) || homeGoals < 0 || !Number.isInteger(homeGoals)) {
          issues.push({ check: 'invalid_scores', severity: 'error', fixtureId: f.id, message: `Invalid home goals: ${homeGoals}` });
        }
        if (Number.isNaN(awayGoals) || awayGoals < 0 || !Number.isInteger(awayGoals)) {
          issues.push({ check: 'invalid_scores', severity: 'error', fixtureId: f.id, message: `Invalid away goals: ${awayGoals}` });
        }
      }
    }

    // chronological_ordering: whole-dataset check
    if (outOfOrder) {
      issues.push({ check: 'chronological_ordering', severity: 'warning', fixtureId: null, message: 'Fixtures are not sorted chronologically by kickoff' });
    }
    // timezone_consistency: whole-dataset check
    if (tzStyles.size > 1) {
      issues.push({ check: 'timezone_consistency', severity: 'warning', fixtureId: null, message: 'Mixed timezone styles (UTC and numeric offset) present' });
    }

    return this.buildReport(dataset.manifest.id, issues);
  }

  private buildReport(datasetId: string, issues: IntegrityIssue[]): IntegrityReport {
    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    const checksWithErrors = new Set(issues.filter((i) => i.severity === 'error').map((i) => i.check));
    const passedChecks = ALL_CHECKS.filter((c) => !checksWithErrors.has(c)).length;
    const totalChecks = ALL_CHECKS.length;

    const base = (100 * passedChecks) / totalChecks;
    const warnPenalty = Math.min(base, warningCount * 0.5);
    const score = Math.max(0, Math.round(base - warnPenalty));

    return {
      datasetId,
      score,
      totalChecks,
      passedChecks,
      issues,
      errorCount,
      warningCount,
      checkedAt: new Date().toISOString(),
      validationVersion: VALIDATION_VERSION,
    };
  }
}

export const defaultIntegrityEngine = new IntegrityEngine();
