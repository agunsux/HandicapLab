// EPIC 39 — Automated Data Integrity Checker Engine
// Performs strict validation rules: Impossible Odds, Impossible Scores, Kickoff consistency, Margin anomalies.

export interface RawFixtureRecord {
  fixtureId: string;
  homeScore?: number | null;
  awayScore?: number | null;
  kickoffIso: string;
  homeOdds?: number | null;
  drawOdds?: number | null;
  awayOdds?: number | null;
  bookmakerMargin?: number | null;
}

export class IntegrityValidatorEngine {
  /** Validate raw fixture record against mathematical invariants */
  static validateFixtureIntegrity(record: RawFixtureRecord): string[] {
    const failures: string[] = [];

    // 1. Impossible Scores
    if (record.homeScore !== undefined && record.homeScore !== null) {
      if (record.homeScore < 0 || record.homeScore > 15 || !Number.isInteger(record.homeScore)) {
        failures.push(`Impossible Home Score: ${record.homeScore}`);
      }
    }
    if (record.awayScore !== undefined && record.awayScore !== null) {
      if (record.awayScore < 0 || record.awayScore > 15 || !Number.isInteger(record.awayScore)) {
        failures.push(`Impossible Away Score: ${record.awayScore}`);
      }
    }

    // 2. Impossible Odds
    if (record.homeOdds !== undefined && record.homeOdds !== null) {
      if (record.homeOdds <= 1.0) failures.push(`Impossible Home Odds: ${record.homeOdds}`);
    }
    if (record.awayOdds !== undefined && record.awayOdds !== null) {
      if (record.awayOdds <= 1.0) failures.push(`Impossible Away Odds: ${record.awayOdds}`);
    }
    if (record.drawOdds !== undefined && record.drawOdds !== null) {
      if (record.drawOdds <= 1.0) failures.push(`Impossible Draw Odds: ${record.drawOdds}`);
    }

    // 3. Margin anomalies
    if (record.bookmakerMargin !== undefined && record.bookmakerMargin !== null) {
      if (record.bookmakerMargin <= 0 || record.bookmakerMargin > 0.15) {
        failures.push(`Anomalous Bookmaker Margin: ${(record.bookmakerMargin * 100).toFixed(1)}%`);
      }
    }

    // 4. Kickoff date validity
    const kickoffMs = Date.parse(record.kickoffIso);
    if (isNaN(kickoffMs)) {
      failures.push(`Invalid Kickoff Date String: ${record.kickoffIso}`);
    }

    return failures;
  }
}
