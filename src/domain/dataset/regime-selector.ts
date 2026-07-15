/**
 * SUPER EPIC 31B.5 — Regime Selector Domain Module
 */

export type StructuralRegime =
  | 'Pre-VAR'
  | 'VAR_Era'
  | 'COVID_ClosedDoor'
  | 'COVID_LimitedAttendance'
  | 'FullCrowd_Normal'
  | 'FixtureCongestion'
  | 'EarlySeason'
  | 'InternationalBreak'
  | 'Unknown';

export class RegimeSelector {
  /**
   * Identifies the structural regime for a match based on its date, season, and features.
   */
  public static selectRegime(matchDate: Date, season: string, features?: { restDays?: number }): StructuralRegime[] {
    const regimes: StructuralRegime[] = [];

    // 1. VAR Era vs Pre-VAR Era
    // VAR was introduced in Premier League at the start of 2019/20 season (August 2019)
    const varCutoff = new Date('2019-08-01');
    if (matchDate >= varCutoff) {
      regimes.push('VAR_Era');
    } else {
      regimes.push('Pre-VAR');
    }

    // 2. COVID Crowd regimes
    const covidClosedStart = new Date('2020-03-01');
    const covidClosedEnd = new Date('2021-05-17'); // Stadiums reopened to limited fans
    const covidLimitedEnd = new Date('2021-08-13'); // Full capacity return at the start of 21/22 season

    if (matchDate >= covidClosedStart && matchDate < covidClosedEnd) {
      regimes.push('COVID_ClosedDoor');
    } else if (matchDate >= covidClosedEnd && matchDate < covidLimitedEnd) {
      regimes.push('COVID_LimitedAttendance');
    } else if (matchDate >= covidLimitedEnd) {
      regimes.push('FullCrowd_Normal');
    }

    // 3. Fixture Congestion
    if (features && features.restDays !== undefined && features.restDays < 4) {
      regimes.push('FixtureCongestion');
    }

    // 4. Early Season
    // Match date falls in August/September of new season start
    const month = matchDate.getMonth(); // 0-indexed (7 = Aug, 8 = Sep)
    if (month === 7 || month === 8) {
      regimes.push('EarlySeason');
    }

    if (regimes.length === 0) {
      regimes.push('Unknown');
    }

    return regimes;
  }
}
