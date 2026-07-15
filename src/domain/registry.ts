/**
 * SUPER EPIC 31B.5 — Historical Validation Laboratory
 * Core Registry Contracts
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface Registry<T> {
  register(item: T): Promise<void>;
  get(id: string): Promise<T>;
  list(): Promise<T[]>;
  validate(id: string): Promise<ValidationResult>;
}
