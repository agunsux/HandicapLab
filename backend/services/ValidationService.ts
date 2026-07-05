import { CanonicalMatch } from '../core/interfaces/MatchDataImporter';

export interface ValidationError {
  row: number;
  column: string;
  reason: string;
}

export class ValidationService {
  /**
   * Performs structural verification over parsed match arrays and reports anomalies.
   */
  public validate(matches: CanonicalMatch[]): { isValid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    matches.forEach((match, idx) => {
      const rowNum = match.metadata.rowNumber || idx + 1;

      // Validate scores
      const goals = match.statistics['goals'];
      if (goals) {
        if (goals.home < 0 || goals.away < 0) {
          errors.push({ row: rowNum, column: 'FTHG/FTAG', reason: 'Goals count cannot be negative' });
        }
      }

      // Validate odds prices
      for (const bookmaker of Object.keys(match.markets)) {
        const selections = match.markets[bookmaker];
        for (const select of Object.keys(selections)) {
          const entry = selections[select];
          if (entry.price <= 1.0) {
            errors.push({ row: rowNum, column: `${bookmaker}_${select}`, reason: 'Odds price must be greater than 1.0' });
          }
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
