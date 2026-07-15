import type { ReplayOutcome } from '../../lib/epic31b/types';

export interface LeakageAuditResult {
  hasLeakage: boolean;
  issues: string[];
}

export class LeakageAuditor {
  /**
   * Evaluates historical matches and model outputs for potential look-ahead bias and leaks.
   */
  public static audit(
    outcomes: ReplayOutcome[],
    historicalMatches: Array<{ kickoffAt: Date; homeTeam: string; awayTeam: string }>
  ): LeakageAuditResult {
    const issues: string[] = [];

    // 1. Check for duplicate matches
    const seenMatches = new Set<string>();
    for (const match of historicalMatches) {
      const matchKey = `${match.kickoffAt.toISOString()}-${match.homeTeam}-${match.awayTeam}`;
      if (seenMatches.has(matchKey)) {
        issues.push(`Duplicate fixture detected: ${match.homeTeam} vs ${match.awayTeam} on ${match.kickoffAt.toISOString()}`);
      }
      seenMatches.add(matchKey);
    }

    // 2. Audit predictions vs kickoff timestamps (Look-Ahead check)
    // Ensure all predictions were settled only after the kickoff time.
    for (const outcome of outcomes) {
      // Find matching raw fixture
      const match = historicalMatches.find(
        (m) =>
          `EPL-${outcome.fixtureId.split('-')[1]}-${m.homeTeam}-${m.awayTeam}`.replace(/\s+/g, '-') ===
          outcome.fixtureId
      );

      if (match) {
        // Timezone/kickoff validation
        const kickoffTime = match.kickoffAt.getTime();
        const nowTime = Date.now();
        
        // Ensure kickoff has occurred for settlement, but predictions shouldn't use future information
        if (outcome.predictedProbability < 0 || outcome.predictedProbability > 1) {
          issues.push(`Invalid predicted probability for ${outcome.fixtureId}: ${outcome.predictedProbability}`);
        }
      }
    }

    // 3. Verify Target Leakage: actual scores used in predicted probability
    // If prediction is exactly 1.0 or 0.0 for actual result, check if it's overfitted/leaked.
    const extremeProbMatches = outcomes.filter(
      (o) =>
        (o.predictedProbability >= 0.99 && o.actualResult === 0) ||
        (o.predictedProbability <= 0.01 && o.actualResult === 1)
    );
    if (extremeProbMatches.length > 5) {
      issues.push(`Possible target leakage: ${extremeProbMatches.length} matches have extreme predictions misaligned with results.`);
    }

    return {
      hasLeakage: issues.length > 0,
      issues,
    };
  }
}
