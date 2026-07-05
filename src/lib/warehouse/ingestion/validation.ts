import {
  CanonicalFixture,
  CanonicalCompetition,
  CanonicalTeam,
  CanonicalOddsSnapshot,
  CanonicalOutcome
} from './canonical';

export type ValidationStatus = 'PASS' | 'WARNING' | 'ERROR' | 'SKIPPED';

export interface ValidationRecord {
  rule: string;
  status: ValidationStatus;
  message: string;
  field?: string;
  timestamp: string;
}

export interface IValidator<T> {
  getName(): string;
  validate(object: T): ValidationRecord[];
}

export interface ValidationSummary {
  totalValidated: number;
  totalFailed: number;
  totalWarnings: number;
  totalErrors: number;
  failureRate: number;
  records: ValidationRecord[];
}

export class ValidationReport {
  private totalValidated = 0;
  private totalFailed = 0;
  private totalWarnings = 0;
  private totalErrors = 0;
  private records: ValidationRecord[] = [];

  public addRecords(validatorName: string, records: ValidationRecord[]) {
    this.totalValidated++;
    this.records.push(...records);

    const hasErrors = records.some(r => r.status === 'ERROR');
    const warningsCount = records.filter(r => r.status === 'WARNING').length;
    const errorsCount = records.filter(r => r.status === 'ERROR').length;

    if (hasErrors) {
      this.totalFailed++;
    }
    this.totalWarnings += warningsCount;
    this.totalErrors += errorsCount;
  }

  public getSummary(): ValidationSummary {
    const failureRate = this.totalValidated > 0 ? (this.totalFailed / this.totalValidated) * 100 : 0;
    return {
      totalValidated: this.totalValidated,
      totalFailed: this.totalFailed,
      totalWarnings: this.totalWarnings,
      totalErrors: this.totalErrors,
      failureRate: Number(failureRate.toFixed(2)),
      records: this.records
    };
  }
}

// 1. Fixture Validator
export class FixtureValidator implements IValidator<CanonicalFixture> {
  public getName(): string {
    return 'FixtureValidator';
  }

  public validate(object: CanonicalFixture): ValidationRecord[] {
    const records: ValidationRecord[] = [];
    const now = new Date().toISOString();

    // Required fields
    if (!object.apiId) {
      records.push({ rule: 'RequiredField', status: 'ERROR', message: 'apiId is required', field: 'apiId', timestamp: now });
    }
    if (!object.competitionApiId) {
      records.push({ rule: 'RequiredField', status: 'ERROR', message: 'competitionApiId is required', field: 'competitionApiId', timestamp: now });
    }

    // Timezone validation (ISO 8601 string checks)
    try {
      const kickoff = new Date(object.kickoffTime);
      if (isNaN(kickoff.getTime())) {
        records.push({ rule: 'DateValidation', status: 'ERROR', message: 'kickoffTime is not a valid date', field: 'kickoffTime', timestamp: now });
      } else if (!object.kickoffTime.endsWith('Z') && !object.kickoffTime.includes('+') && !object.kickoffTime.includes('-')) {
        // Warning if kickoffTime timezone information is missing (should default to UTC)
        records.push({ rule: 'TimezoneValidation', status: 'WARNING', message: 'kickoffTime should specify UTC or timezone offset', field: 'kickoffTime', timestamp: now });
      }
    } catch {
      records.push({ rule: 'DateValidation', status: 'ERROR', message: 'Failed to parse kickoffTime', field: 'kickoffTime', timestamp: now });
    }

    // Business rule check: homeTeam and awayTeam cannot be identical
    if (object.homeTeamApiId && object.awayTeamApiId && object.homeTeamApiId === object.awayTeamApiId) {
      records.push({ rule: 'BusinessRule', status: 'ERROR', message: 'Home team and away team cannot be identical', field: 'homeTeamApiId', timestamp: now });
    }

    // Goals check
    if (object.homeGoals !== undefined && object.homeGoals < 0) {
      records.push({ rule: 'RangeValidation', status: 'ERROR', message: 'homeGoals cannot be negative', field: 'homeGoals', timestamp: now });
    }
    if (object.awayGoals !== undefined && object.awayGoals < 0) {
      records.push({ rule: 'RangeValidation', status: 'ERROR', message: 'awayGoals cannot be negative', field: 'awayGoals', timestamp: now });
    }

    return records;
  }
}

// 2. League/Competition Validator
export class CompetitionValidator implements IValidator<CanonicalCompetition> {
  public getName(): string {
    return 'CompetitionValidator';
  }

  public validate(object: CanonicalCompetition): ValidationRecord[] {
    const records: ValidationRecord[] = [];
    const now = new Date().toISOString();

    if (!object.apiId) {
      records.push({ rule: 'RequiredField', status: 'ERROR', message: 'apiId is required', field: 'apiId', timestamp: now });
    }
    if (!object.name) {
      records.push({ rule: 'RequiredField', status: 'ERROR', message: 'name is required', field: 'name', timestamp: now });
    }
    if (!object.country) {
      records.push({ rule: 'RequiredField', status: 'WARNING', message: 'country is missing, defaulting to Unknown', field: 'country', timestamp: now });
    }

    return records;
  }
}

// 3. Team Validator
export class TeamValidator implements IValidator<CanonicalTeam> {
  public getName(): string {
    return 'TeamValidator';
  }

  public validate(object: CanonicalTeam): ValidationRecord[] {
    const records: ValidationRecord[] = [];
    const now = new Date().toISOString();

    if (!object.apiId) {
      records.push({ rule: 'RequiredField', status: 'ERROR', message: 'apiId is required', field: 'apiId', timestamp: now });
    }
    if (!object.name) {
      records.push({ rule: 'RequiredField', status: 'ERROR', message: 'name is required', field: 'name', timestamp: now });
    }

    return records;
  }
}

// 4. Odds Snapshot Validator
export class OddsSnapshotValidator implements IValidator<CanonicalOddsSnapshot> {
  public getName(): string {
    return 'OddsSnapshotValidator';
  }

  public validate(object: CanonicalOddsSnapshot): ValidationRecord[] {
    const records: ValidationRecord[] = [];
    const now = new Date().toISOString();

    if (!object.fixtureId) {
      records.push({ rule: 'RequiredField', status: 'ERROR', message: 'fixtureId is required', field: 'fixtureId', timestamp: now });
    }
    if (!object.bookmakerId) {
      records.push({ rule: 'RequiredField', status: 'ERROR', message: 'bookmakerId is required', field: 'bookmakerId', timestamp: now });
    }
    if (!object.outcomes || object.outcomes.length === 0) {
      records.push({ rule: 'RequiredField', status: 'ERROR', message: 'outcomes list cannot be empty', field: 'outcomes', timestamp: now });
      return records;
    }

    // Probability & Odds checks
    let sumProbability = 0;
    for (const outcome of object.outcomes) {
      if (outcome.odds <= 1.0) {
        records.push({ rule: 'OddsValidation', status: 'ERROR', message: `Odds must be strictly greater than 1.0. Found: ${outcome.odds}`, field: 'odds', timestamp: now });
      } else {
        sumProbability += (1 / outcome.odds);
      }
    }

    // Check for negative overround / margins (sumProbability should be close to 1.0 or higher)
    if (sumProbability < 0.90) {
      records.push({ rule: 'ProbabilityValidation', status: 'WARNING', message: `Sum of implied probabilities is abnormally low: ${sumProbability.toFixed(3)}`, field: 'outcomes', timestamp: now });
    }

    return records;
  }
}
