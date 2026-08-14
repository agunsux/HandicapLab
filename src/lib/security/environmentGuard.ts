/**
 * P0 Data Quarantine & Environment Isolation Guard
 * Prevents synthetic/mock scripts from executing against production.
 */

export class SecurityGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityGuardError';
  }
}

/**
 * Ensures the current script is not executing in a production environment
 * or pointing to the production database.
 */
export function assertNotProduction() {
  const isProdEnv = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  
  // rgkrfzxipkrwqccfuqfq is the known production instance id
  const isProdDb = supabaseUrl.includes('rgkrfzxipkrwqccfuqfq');

  if (isProdEnv || isProdDb) {
    throw new SecurityGuardError(
      'ENVIRONMENT ISOLATION VIOLATION: Execution of this script is blocked in production. ' +
      'Check your NODE_ENV and SUPABASE_URL.'
    );
  }
}

export type SourceType = 'PROVIDER' | 'HISTORICAL' | 'SYNTHETIC' | 'QUARANTINED_SYNTHETIC' | 'MANUAL' | 'UNKNOWN';

/**
 * Validates that data intended for production ingestion is not synthetic or unknown.
 */
export function assertValidProvenance(sourceType: SourceType | undefined | null) {
  if (!sourceType || sourceType === 'UNKNOWN') {
    throw new SecurityGuardError('PROVENANCE VIOLATION: Source type is UNKNOWN or missing.');
  }
  
  if (sourceType === 'SYNTHETIC' || sourceType === 'QUARANTINED_SYNTHETIC') {
    throw new SecurityGuardError('PROVENANCE VIOLATION: Synthetic data cannot be ingested into production.');
  }
  
  const validSources = ['PROVIDER', 'HISTORICAL', 'MANUAL'];
  if (!validSources.includes(sourceType as string)) {
    throw new SecurityGuardError(`PROVENANCE VIOLATION: Invalid source type '${sourceType}'.`);
  }
}
