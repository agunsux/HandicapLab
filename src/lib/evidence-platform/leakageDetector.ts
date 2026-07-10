/**
 * Sprint A6 — Leakage Detection
 * ==============================
 * Detects historical data leakage in a CanonicalDataset.
 *
 * Verifies (per ARCHITECTURE_INVARIANTS §11 — No Future Information):
 *   - future data leakage      (odds timestamped after kickoff)
 *   - post-match fields        (result present on a not-yet-played fixture)
 *   - closing odds leakage     (closing odds used as if pre-match)
 *   - result leakage           (result attached to scheduled fixture)
 *   - feature timestamp validation (feature known after kickoff)
 *
 * Any error-severity issue causes the dataset to be rejected (`passed=false`).
 * Pure function: deterministic for identical inputs.
 */

import type { CanonicalDataset } from '../dataset/types';
import { VALIDATION_VERSION } from './types';
import type { FeatureTimestampInput, LeakageIssue, LeakageReport } from './types';

export interface LeakageOptions {
  /**
   * When true (default), the mere presence of closing odds is flagged as a
   * warning because closing odds must never influence pre-match predictions.
   */
  readonly flagClosingOdds?: boolean;
  readonly featureTimestamps?: readonly FeatureTimestampInput[];
}

export class LeakageDetector {
  detect(dataset: CanonicalDataset, options: LeakageOptions = {}): LeakageReport {
    const flagClosingOdds = options.flagClosingOdds ?? true;
    const issues: LeakageIssue[] = [];

    for (const match of dataset.matches) {
      const f = match.fixture;
      const kickoffMs = new Date(f.kickoff).getTime();
      const kickoffValid = !Number.isNaN(kickoffMs);

      // future_data: odds timestamped after kickoff
      for (const o of match.odds) {
        const oddsMs = new Date(o.timestamp).getTime();
        if (kickoffValid && !Number.isNaN(oddsMs) && oddsMs > kickoffMs) {
          issues.push({
            check: 'future_data',
            fixtureId: f.id,
            field: 'odds.timestamp',
            message: `Odds timestamp (${o.timestamp}) is after kickoff (${f.kickoff})`,
            severity: 'error',
          });
        }

        // closing_odds: closing odds present — must not feed pre-match features
        if (flagClosingOdds && (o.closingHomeOdds !== undefined || o.closingAwayOdds !== undefined || o.closingDrawOdds !== undefined)) {
          issues.push({
            check: 'closing_odds',
            fixtureId: f.id,
            field: 'odds.closing',
            message: 'Closing odds present; must never influence pre-match predictions',
            severity: 'warning',
          });
        }
      }

      // post_match_field / result_leakage: result on a not-finished fixture
      if (match.result && f.status !== 'finished') {
        issues.push({
          check: 'result_leakage',
          fixtureId: f.id,
          field: 'result',
          message: `Result present on ${f.status} fixture (post-match field before completion)`,
          severity: 'error',
        });
        issues.push({
          check: 'post_match_field',
          fixtureId: f.id,
          field: 'result',
          message: 'Post-match result field must not exist before the match is finished',
          severity: 'error',
        });
      }
    }

    // feature_timestamp validation
    if (options.featureTimestamps && options.featureTimestamps.length > 0) {
      const kickoffByFixture = new Map(dataset.matches.map((m) => [m.fixture.id, m.fixture.kickoff]));
      for (const ft of options.featureTimestamps) {
        const kickoff = kickoffByFixture.get(ft.fixtureId);
        if (!kickoff) continue;
        const kickoffMs = new Date(kickoff).getTime();
        const featureMs = new Date(ft.timestamp).getTime();
        if (!Number.isNaN(kickoffMs) && !Number.isNaN(featureMs) && featureMs > kickoffMs) {
          issues.push({
            check: 'feature_timestamp',
            fixtureId: ft.fixtureId,
            field: ft.feature,
            message: `Feature "${ft.feature}" known at ${ft.timestamp}, after kickoff ${kickoff}`,
            severity: 'error',
          });
        }
      }
    }

    const passed = issues.every((i) => i.severity !== 'error');

    return {
      datasetId: dataset.manifest.id,
      passed,
      issues,
      checkedAt: new Date().toISOString(),
      validationVersion: VALIDATION_VERSION,
    };
  }
}

export const defaultLeakageDetector = new LeakageDetector();
