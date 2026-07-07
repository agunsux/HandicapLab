export type ValidationSeverity = 'FATAL' | 'WARNING' | 'INFO';

export interface ValidationError {
  field?: string;
  message: string;
  severity: ValidationSeverity;
  rule?: string;
}

export interface ValidationReport {
  isValid: boolean; // True if no FATAL errors
  errors: ValidationError[];
}

/**
 * Interface for Schema Validation.
 * Focuses on data types, presence of required fields, and structural integrity.
 */
export interface ISchemaValidator {
  schemaName: string;
  schemaVersion: string;
  validateRow(row: any): ValidationReport;
  validateBatch(rows: any[]): ValidationReport;
}

/**
 * Interface for Business Validation.
 * Focuses on domain logic (e.g. odds > 1, home != away).
 */
export interface IBusinessValidator {
  validateRow(row: any): ValidationReport;
  validateBatch(rows: any[]): ValidationReport;
}

export interface DatasetRecordMetadata {
  schema_name: string;
  schema_version: string;
}
