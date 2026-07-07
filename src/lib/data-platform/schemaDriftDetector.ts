export interface SchemaDriftResult {
  isValid: boolean;
  errors: string[];
}

export class SchemaDriftDetector {
  /**
   * Detects if the incoming raw data matches the expected baseline schema.
   * Fails fast if constraints are broken.
   */
  public static validate(rows: any[], expectedSchema: Record<string, string>): SchemaDriftResult {
    const errors: string[] = [];
    
    if (!rows || rows.length === 0) {
        return { isValid: false, errors: ['Dataset is empty'] };
    }

    const expectedKeys = Object.keys(expectedSchema);
    
    // Sample first row for schema matching
    const sample = rows[0];
    for (const key of expectedKeys) {
        if (!(key in sample)) {
            errors.push(`Missing required column: ${key}`);
        }
    }

    // Perform validation checks on a subset or all rows
    // (e.g. check for null rates, negative goals, invalid odds)
    let nullTeamCount = 0;
    
    for (const row of rows) {
        if (row['FTHG'] < 0 || row['FTAG'] < 0) {
            errors.push(`Negative goals detected in row: ${JSON.stringify(row)}`);
            break; 
        }
        if (row['HomeTeam'] === null || row['AwayTeam'] === null) {
            nullTeamCount++;
        }
    }

    if (nullTeamCount > 0) {
        errors.push(`Found ${nullTeamCount} rows with null teams.`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
