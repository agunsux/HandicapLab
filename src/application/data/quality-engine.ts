import { CanonicalFixture, CanonicalOdds } from '../../domain/dataset/canonical';

export interface DataQualityReport {
  overallScore: number; // 0 - 100
  missingPct: number;
  conflictPct: number;
  mergedPct: number;
  aliasPct: number;
  duplicatePct: number;
  coveragePct: number;
  conflictCount: number;
  duplicateCount: number;
  missingOddsCount: number;
  missingXgCount: number;
  issues: string[];
}

export class DataQualityEngine {
  /**
   * Evaluates fixtures and associated odds to produce a Data Quality Report.
   */
  public static evaluate(
    fixtures: CanonicalFixture[],
    allOdds: CanonicalOdds[],
    conflictCount: number
  ): DataQualityReport {
    const issues: string[] = [];
    const totalFixtures = fixtures.length;

    if (totalFixtures === 0) {
      return {
        overallScore: 0,
        missingPct: 0,
        conflictPct: 0,
        mergedPct: 0,
        aliasPct: 0,
        duplicatePct: 0,
        coveragePct: 0,
        conflictCount: 0,
        duplicateCount: 0,
        missingOddsCount: 0,
        missingXgCount: 0,
        issues: ['No fixtures provided for validation']
      };
    }

    let missingGoalsCount = 0;
    let missingXgCount = 0;
    let missingRefereeCount = 0;
    let missingOddsCount = 0;
    let duplicateFixturesCount = 0;
    let invalidOddsCount = 0;

    const seenNaturalKeys = new Set<string>();
    const fixturesWithOdds = new Set<string>(allOdds.map(o => o.fixtureId));

    fixtures.forEach((f, idx) => {
      // 1. Natural key duplicates
      if (seenNaturalKeys.has(f.fixtureNaturalKey)) {
        duplicateFixturesCount++;
        issues.push(`Duplicate fixture natural key: ${f.fixtureNaturalKey}`);
      } else {
        seenNaturalKeys.add(f.fixtureNaturalKey);
      }

      // 2. Missing goals
      if (f.homeGoals.value === null || f.awayGoals.value === null) {
        missingGoalsCount++;
      }

      // 3. Missing expected goals (xG)
      if (f.homeXg.value === null || f.awayXg.value === null) {
        missingXgCount++;
      }

      // 4. Missing referee
      if (!f.referee.value) {
        missingRefereeCount++;
      }

      // 5. Missing odds connection
      if (!fixturesWithOdds.has(f.fixtureId)) {
        missingOddsCount++;
      }
    });

    // Validate odds decimals
    allOdds.forEach((o, idx) => {
      if (o.oddsDecimal <= 1.0) {
        invalidOddsCount++;
        issues.push(`Invalid odds decimal (${o.oddsDecimal}) for fixture ID ${o.fixtureId}`);
      }
    });

    const totalFieldsEvaluated = totalFixtures * 10; // 10 major fields per fixture
    let missingFieldsCount = missingGoalsCount * 2 + missingXgCount * 2 + missingRefereeCount + missingOddsCount;
    
    // Percentages
    const missingPct = Number(((missingFieldsCount / totalFieldsEvaluated) * 100).toFixed(2));
    const conflictPct = Number(((conflictCount / totalFixtures) * 100).toFixed(2));
    const duplicatePct = Number(((duplicateFixturesCount / totalFixtures) * 100).toFixed(2));
    
    // Coverage: fraction of fixtures with full results + odds + xG
    const completeFixtures = fixtures.filter(
      f => f.homeGoals.value !== null && f.homeXg.value !== null && fixturesWithOdds.has(f.fixtureId)
    ).length;
    const coveragePct = Number(((completeFixtures / totalFixtures) * 100).toFixed(2));

    // Alias mapping success: mapped to valid canonical teams
    const aliasPct = 100.0; // Handled by TeamRegistry during ID slug resolution

    // Merged percentage: fraction of fields that had input from more than 1 provider
    const mergedFixtures = fixtures.filter(f => f.lineage.length > 1).length;
    const mergedPct = Number(((mergedFixtures / totalFixtures) * 100).toFixed(2));

    // Quality Score Calculation
    // Overall quality is base 100, penalized by missing fields, conflicts, duplicates, and invalid odds.
    let overallScore = 100 - (missingPct * 0.5) - (conflictPct * 0.3) - (duplicatePct * 1.5) - (invalidOddsCount * 2);
    overallScore = Math.max(0, Math.min(100, Math.round(overallScore * 100) / 100));

    if (missingGoalsCount > 0) issues.push(`Found ${missingGoalsCount} fixtures with missing actual goals.`);
    if (missingXgCount > 0) issues.push(`Found ${missingXgCount} fixtures with missing expected goals (xG).`);
    if (missingOddsCount > 0) issues.push(`Found ${missingOddsCount} fixtures with no corresponding bookmaker odds.`);
    if (conflictCount > 0) issues.push(`Detected ${conflictCount} field-level provider conflicts.`);

    return {
      overallScore,
      missingPct,
      conflictPct,
      mergedPct,
      aliasPct,
      duplicatePct,
      coveragePct,
      conflictCount,
      duplicateCount: duplicateFixturesCount,
      missingOddsCount,
      missingXgCount,
      issues
    };
  }
}
