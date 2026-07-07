import { IBusinessValidator, ValidationReport, ValidationError } from './types';

export class MatchBusinessValidator implements IBusinessValidator {
  validateRow(row: any): ValidationReport {
    const errors: ValidationError[] = [];
    let isValid = true;

    // 1. home != away
    if (row.home_team && row.away_team && row.home_team === row.away_team) {
      isValid = false;
      errors.push({
        field: 'home_team',
        message: 'Home team cannot be the same as Away team',
        severity: 'FATAL',
        rule: 'business_team_identity'
      });
    }

    // 2. goal >= 0
    if (row.home_goals !== undefined && row.home_goals !== null && row.home_goals < 0) {
      isValid = false;
      errors.push({
        field: 'home_goals',
        message: 'Goals cannot be negative',
        severity: 'FATAL',
        rule: 'business_goal_range'
      });
    }
    if (row.away_goals !== undefined && row.away_goals !== null && row.away_goals < 0) {
      isValid = false;
      errors.push({
        field: 'away_goals',
        message: 'Goals cannot be negative',
        severity: 'FATAL',
        rule: 'business_goal_range'
      });
    }

    // 3. odds > 1
    const oddsFields = ['odds_home', 'odds_draw', 'odds_away'];
    for (const field of oddsFields) {
      if (row[field] !== undefined && row[field] !== null && row[field] < 1.0) {
        isValid = false;
        errors.push({
          field,
          message: 'Odds must be >= 1.0',
          severity: 'FATAL',
          rule: 'business_odds_range'
        });
      }
    }

    // Info logging
    if (row.status === 'rescheduled') {
      errors.push({
        field: 'status',
        message: 'Match is rescheduled. Point-in-time rules will apply stricter available_at checks.',
        severity: 'INFO',
        rule: 'business_reschedule_alert'
      });
    }

    return { isValid, errors };
  }

  validateBatch(rows: any[]): ValidationReport {
    let isValid = true;
    const allErrors: ValidationError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const report = this.validateRow(rows[i]);
      if (!report.isValid) isValid = false;
      report.errors.forEach(e => allErrors.push({ ...e, field: `row[${i}].${e.field}` }));
    }

    return { isValid, errors: allErrors };
  }
}
