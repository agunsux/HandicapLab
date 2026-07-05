import { describe, it, expect } from 'vitest';
import {
  FixtureValidator,
  OddsSnapshotValidator,
  CompetitionValidator,
  ValidationReport
} from '../src/lib/warehouse/ingestion/validation';
import { CanonicalFixture, CanonicalOddsSnapshot, CanonicalCompetition } from '../src/lib/warehouse/ingestion/canonical';

describe('FixtureValidator Rules', () => {
  const validator = new FixtureValidator();

  it('should pass on a fully valid fixture', () => {
    const fixture: CanonicalFixture = {
      apiId: 100,
      competitionApiId: 39,
      seasonYear: 2026,
      kickoffTime: '2026-07-01T12:00:00Z',
      status: 'scheduled',
      homeTeamApiId: 10,
      awayTeamApiId: 20
    };

    const results = validator.validate(fixture);
    const errors = results.filter(r => r.status === 'ERROR');
    expect(errors.length).toBe(0);
  });

  it('should flag an error if home and away teams are identical', () => {
    const fixture: CanonicalFixture = {
      apiId: 100,
      competitionApiId: 39,
      seasonYear: 2026,
      kickoffTime: '2026-07-01T12:00:00Z',
      status: 'scheduled',
      homeTeamApiId: 10,
      awayTeamApiId: 10 // Identical
    };

    const results = validator.validate(fixture);
    const businessErrors = results.filter(r => r.rule === 'BusinessRule' && r.status === 'ERROR');
    expect(businessErrors.length).toBe(1);
  });

  it('should flag negative goals as a range error', () => {
    const fixture: CanonicalFixture = {
      apiId: 100,
      competitionApiId: 39,
      seasonYear: 2026,
      kickoffTime: '2026-07-01T12:00:00Z',
      status: 'finished',
      homeTeamApiId: 10,
      awayTeamApiId: 20,
      homeGoals: -1 // Negative
    };

    const results = validator.validate(fixture);
    const rangeErrors = results.filter(r => r.rule === 'RangeValidation' && r.status === 'ERROR');
    expect(rangeErrors.length).toBe(1);
  });
});

describe('OddsSnapshotValidator Rules', () => {
  const validator = new OddsSnapshotValidator();

  it('should flag odds <= 1.0 as an error', () => {
    const snapshot: CanonicalOddsSnapshot = {
      fixtureId: 1001,
      bookmakerId: 6,
      marketId: 1,
      timestamp: '2026-07-01T12:00:00Z',
      outcomes: [
        { selection: 'Home', odds: 0.95 },
        { selection: 'Away', odds: 2.10 }
      ]
    };

    const results = validator.validate(snapshot);
    const oddsErrors = results.filter(r => r.rule === 'OddsValidation' && r.status === 'ERROR');
    expect(oddsErrors.length).toBe(1);
  });
});

describe('ValidationReport Summaries', () => {
  it('should aggregate metrics correctly', () => {
    const report = new ValidationReport();
    const compValidator = new CompetitionValidator();

    const validComp: CanonicalCompetition = {
      apiId: 39,
      name: 'Premier League',
      country: 'England',
      type: 'league'
    };

    const invalidComp: CanonicalCompetition = {
      apiId: 0, // Missing ID
      name: '', // Missing name
      country: 'England',
      type: 'league'
    };

    report.addRecords('Comp1', compValidator.validate(validComp));
    report.addRecords('Comp2', compValidator.validate(invalidComp));

    const summary = report.getSummary();
    expect(summary.totalValidated).toBe(2);
    expect(summary.totalFailed).toBe(1); // InvalidComp has errors
    expect(summary.totalErrors).toBe(2); // Two missing fields
    expect(summary.failureRate).toBe(50.0);
  });
});
