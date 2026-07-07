import { z } from 'zod';
import { ISchemaValidator, ValidationReport, ValidationError } from './types';

// Strict schema for canonical fixture v1.0.0
const canonicalFixtureSchemaV1 = z.object({
  match_id: z.string().min(1, "match_id cannot be empty"),
  competition_id: z.string().min(1, "competition_id cannot be empty"),
  season: z.string().min(4, "season format invalid"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "date must be YYYY-MM-DD"),
  
  // Data Availability tracking fields
  event_time: z.string().optional(),
  provider_time: z.string().optional(),
  available_at: z.string().optional(),
  ingested_at: z.string().optional(),
  processed_at: z.string().optional(),

  home_team: z.string().min(1),
  away_team: z.string().min(1),
  home_goals: z.number().int().optional().nullable(),
  away_goals: z.number().int().optional().nullable(),
  odds_home: z.number().optional().nullable(),
  odds_draw: z.number().optional().nullable(),
  odds_away: z.number().optional().nullable(),
  status: z.string().optional(),
}).passthrough(); // pass unknown keys as warnings later or strip them

export class ZodSchemaValidator implements ISchemaValidator {
  public schemaName = 'canonical_fixture';
  public schemaVersion = '1.0.0';

  validateRow(row: any): ValidationReport {
    const errors: ValidationError[] = [];
    let isValid = true;

    // Check for extra keys for WARNING
    const expectedKeys = Object.keys(canonicalFixtureSchemaV1.shape);
    const rowKeys = Object.keys(row);
    for (const key of rowKeys) {
      if (!expectedKeys.includes(key)) {
        errors.push({
          field: key,
          message: `Unknown extra column '${key}' detected.`,
          severity: 'WARNING',
          rule: 'extra_column'
        });
      }
    }

    const result = canonicalFixtureSchemaV1.safeParse(row);
    if (!result.success) {
      isValid = false;
      for (const err of result.error.issues) {
        errors.push({
          field: err.path.join('.'),
          message: err.message,
          severity: 'FATAL',
          rule: err.code
        });
      }
    }

    // Check Nullability explicitly if not caught by zod structure
    if (row.competition_id === null) {
        isValid = false;
        errors.push({ field: 'competition_id', message: 'competition_id cannot be null', severity: 'FATAL' });
    }

    return { isValid, errors };
  }

  validateBatch(rows: any[]): ValidationReport {
    let isValid = true;
    const allErrors: ValidationError[] = [];

    // Duplicate detection (naive on match_id)
    const seenIds = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const report = this.validateRow(row);
      
      if (!report.isValid) isValid = false;
      
      // Prefix field with row index
      report.errors.forEach(e => {
        allErrors.push({ ...e, field: `row[${i}].${e.field}` });
      });

      if (row.match_id) {
        if (seenIds.has(row.match_id)) {
            isValid = false;
            allErrors.push({
                field: `row[${i}].match_id`,
                message: `Duplicate match_id detected: ${row.match_id}`,
                severity: 'FATAL',
                rule: 'unique_pk'
            });
        }
        seenIds.add(row.match_id);
      }
    }

    return { isValid, errors: allErrors };
  }
}
