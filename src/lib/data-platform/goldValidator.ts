// HandicapLab Live Data Platform - Gold Dataset Validator
// Location: src/lib/data-platform/goldValidator.ts

import {
  CanonicalFixture,
  CanonicalOdds,
  CanonicalLineup,
  CanonicalInjury,
  CanonicalReferee,
  CanonicalTeamStats
} from './canonicalModel';

export interface GoldValidationReport {
  score: number; // 0 - 100
  passed: boolean;
  issues: string[];
  duplicateCount: number;
  missingOddsCount: number;
  impossibleScoreCount: number;
  kickoffMismatchCount: number;
  teamMismatchCount: number;
  timezoneMismatchCount: number;
  oddsInversionCount: number;
}

export class GoldValidator {
  /**
   * Automatically validates the dataset tables and computes a quality score.
   */
  public static validate(
    fixtures: CanonicalFixture[],
    oddsOpen: CanonicalOdds[],
    oddsClose: CanonicalOdds[]
  ): GoldValidationReport {
    const issues: string[] = [];
    let duplicateCount = 0;
    let missingOddsCount = 0;
    let impossibleScoreCount = 0;
    let kickoffMismatchCount = 0;
    let teamMismatchCount = 0;
    let timezoneMismatchCount = 0;
    let oddsInversionCount = 0;

    const fixtureIds = new Set<string>();
    
    // Validate Fixtures
    fixtures.forEach((f, idx) => {
      // 1. Duplicate check
      if (fixtureIds.has(f.match_id)) {
        duplicateCount++;
        issues.push(`Duplicate fixture ID: ${f.match_id}`);
      } else {
        fixtureIds.add(f.match_id);
      }

      // 2. Team mismatch
      if (!f.home_team_id || !f.away_team_id) {
        teamMismatchCount++;
        issues.push(`Missing team name in fixture index ${idx}`);
      } else if (f.home_team_id === f.away_team_id) {
        teamMismatchCount++;
        issues.push(`Home and Away teams are identical: ${f.home_team_id} in fixture ${f.match_id}`);
      }

      // 3. Impossible score
      if (f.home_goals !== undefined && f.home_goals !== null) {
        if (f.home_goals < 0 || f.home_goals > 20) {
          impossibleScoreCount++;
          issues.push(`Impossible Home goals score: ${f.home_goals} in fixture ${f.match_id}`);
        }
      }
      if (f.away_goals !== undefined && f.away_goals !== null) {
        if (f.away_goals < 0 || f.away_goals > 20) {
          impossibleScoreCount++;
          issues.push(`Impossible Away goals score: ${f.away_goals} in fixture ${f.match_id}`);
        }
      }

      // 4. Kickoff & Timezone mismatch
      const kickoff = new Date(f.kickoff);
      if (isNaN(kickoff.getTime())) {
        kickoffMismatchCount++;
        issues.push(`Invalid kickoff date/time string: ${f.kickoff} in fixture ${f.match_id}`);
      } else {
        const year = kickoff.getUTCFullYear();
        if (year < 2010 || year > 2030) {
          kickoffMismatchCount++;
          issues.push(`Kickoff date out of standard EPL timeline range (2010-2030): ${f.kickoff} in fixture ${f.match_id}`);
        }
      }

      if (!f.kickoff.endsWith('Z') && !f.kickoff.includes('+00:00')) {
        timezoneMismatchCount++;
        issues.push(`Kickoff timezone is not in UTC format: ${f.kickoff} in fixture ${f.match_id}`);
      }
    });

    // Validate Odds
    const validateOddsList = (oddsList: CanonicalOdds[], label: string) => {
      const seenOddsKey = new Set<string>();

      // Group odds by fixture to check for inversions
      const oddsByFixture: Record<string, Record<string, number>> = {};

      oddsList.forEach((o, idx) => {
        // Missing/Invalid odds
        if (o.oddsDecimal === undefined || o.oddsDecimal === null || isNaN(o.oddsDecimal) || o.oddsDecimal <= 1.0) {
          missingOddsCount++;
          issues.push(`Invalid/missing decimal odds: ${o.oddsDecimal} in ${label} odds index ${idx}`);
        }

        // Duplicate odds update
        const key = `${o.fixtureId}:${o.provider}:${o.marketType}:${o.selection}:${o.line || ''}`;
        if (seenOddsKey.has(key)) {
          duplicateCount++;
          issues.push(`Duplicate odds line: ${key} in ${label} odds index ${idx}`);
        } else {
          seenOddsKey.add(key);
        }

        // Odds inversion tracking
        if (o.marketType === 'ML' && o.oddsDecimal > 1.0) {
          if (!oddsByFixture[o.fixtureId]) {
            oddsByFixture[o.fixtureId] = { home: 0, draw: 0, away: 0 };
          }
          if (o.selection === 'home') oddsByFixture[o.fixtureId].home = o.oddsDecimal;
          if (o.selection === 'draw') oddsByFixture[o.fixtureId].draw = o.oddsDecimal;
          if (o.selection === 'away') oddsByFixture[o.fixtureId].away = o.oddsDecimal;
        }
      });

      // Assert ML Overrounds
      Object.entries(oddsByFixture).forEach(([fixId, ml]) => {
        if (ml.home > 0 && ml.draw > 0 && ml.away > 0) {
          const sumProb = (1 / ml.home) + (1 / ml.draw) + (1 / ml.away);
          if (sumProb > 1.25 || sumProb <= 0.8) {
            oddsInversionCount++;
            issues.push(`Odds inversion/Excessive overround: implied probability sum is ${sumProb.toFixed(3)} for fixture ${fixId}`);
          }
        }
      });
    };

    validateOddsList(oddsOpen, 'open');
    validateOddsList(oddsClose, 'close');

    const totalDeductions =
      duplicateCount * 2 +
      missingOddsCount * 5 +
      impossibleScoreCount * 10 +
      kickoffMismatchCount * 5 +
      teamMismatchCount * 10 +
      timezoneMismatchCount * 2 +
      oddsInversionCount * 5;

    const score = Math.max(0, 100 - totalDeductions);
    const passed = score >= 95;

    return {
      score,
      passed,
      issues,
      duplicateCount,
      missingOddsCount,
      impossibleScoreCount,
      kickoffMismatchCount,
      teamMismatchCount,
      timezoneMismatchCount,
      oddsInversionCount
    };
  }
}
