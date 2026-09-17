import { describe, it, expect } from 'vitest';
import { StrictWalkForwardAdapter } from '../../src/lib/research/real-yield/walkForwardAdapter';
import { HierarchicalDixonColesModel } from '../../src/lib/research/model-a/hierarchicalDixonColes';
import { CanonicalMatch } from '../../src/lib/research/model-a/types';

describe('Real Market Yield — Strict Anti-Leakage & Temporal Invariants', () => {
  it('1. Throws immediate exception if any training observation has matchDate >= kickoffDate', () => {
    const fixture: CanonicalMatch = {
      canonicalId: 'ENG-PL|2019-2020|2019-10-19|chelsea|newcastle',
      leagueId: 'ENG-PL',
      season: '2019-2020',
      matchDate: '2019-10-19',
      homeTeam: 'Chelsea',
      awayTeam: 'Newcastle',
      homeGoals: 1,
      awayGoals: 0,
      odds: {} as any,
    };

    // Construct contaminated match list with a future match
    const contaminatedMatches: CanonicalMatch[] = [
      {
        canonicalId: 'ENG-PL|2019-2020|2019-10-18|everton|west-ham',
        leagueId: 'ENG-PL',
        season: '2019-2020',
        matchDate: '2019-10-18',
        homeTeam: 'Everton',
        awayTeam: 'West Ham',
        homeGoals: 2,
        awayGoals: 0,
        odds: {} as any,
      },
      {
        canonicalId: 'ENG-PL|2019-2020|2019-10-20|man-utd|liverpool', // FUTURE MATCH!
        leagueId: 'ENG-PL',
        season: '2019-2020',
        matchDate: '2019-10-20',
        homeTeam: 'Man United',
        awayTeam: 'Liverpool',
        homeGoals: 1,
        awayGoals: 1,
        odds: {} as any,
      },
    ];

    // Attempting to fit Dixon Coles directly with future match must throw
    expect(() => {
      HierarchicalDixonColesModel.fitLeague(
        contaminatedMatches,
        'ENG-PL',
        fixture.matchDate // '2019-10-19'
      );
    }).toThrow(/\[ANTI-LEAKAGE VIOLATION\]/);

    // Attempting to fit with same-day match must also throw
    const sameDayContamination: CanonicalMatch[] = [
      {
        canonicalId: 'ENG-PL|2019-2020|2019-10-19|spurs|watford', // SAME DAY MATCH!
        leagueId: 'ENG-PL',
        season: '2019-2020',
        matchDate: '2019-10-19',
        homeTeam: 'Tottenham',
        awayTeam: 'Watford',
        homeGoals: 1,
        awayGoals: 1,
        odds: {} as any,
      },
    ];

    expect(() => {
      HierarchicalDixonColesModel.fitLeague(
        sameDayContamination,
        'ENG-PL',
        fixture.matchDate
      );
    }).toThrow(/\[ANTI-LEAKAGE VIOLATION\]/);
  });

  it('2. Exposes complete, auditable prediction metadata proving temporal boundaries', async () => {
    const matches = await StrictWalkForwardAdapter.loadCanonicalMatches();
    // Pick a test fixture in 2018-2019 season
    const fixture = matches.find(
      (m) => m.leagueId === 'ENG-PL' && m.matchDate === '2018-12-26' && m.homeTeam === 'Liverpool'
    );
    expect(fixture).toBeDefined();

    const pred = StrictWalkForwardAdapter.predictFixture(fixture!, matches);

    // Auditable metadata verification
    expect(pred.fixtureId).toBe(fixture!.canonicalId);
    expect(pred.leagueId).toBe(fixture!.leagueId);
    expect(pred.season).toBe(fixture!.season);
    expect(pred.kickoffDate).toBe(fixture!.matchDate);
    expect(pred.modelVersion).toBe('HierarchicalDixonColes-ModelA-v1');

    // Timestamps: prediction timestamp strictly prior to kickoff timestamp
    const predTime = new Date(pred.predictionTimestamp).getTime();
    const kickTime = new Date(pred.kickoffTimestamp).getTime();
    expect(predTime).toBeLessThan(kickTime);

    // Training boundary verification:
    expect(pred.trainingCutoffDate).toBe(fixture!.matchDate);
    expect(pred.trainingObservationCount).toBeGreaterThan(50);
    expect(pred.lastTrainingMatchDate).not.toBeNull();
    expect(pred.lastTrainingMatchDate! < fixture!.matchDate).toBe(true);

    // Model parameters exist and are well-formed
    expect(pred.modelConfig.mu).toBeGreaterThan(0);
    expect(pred.modelConfig.gamma).toBeGreaterThan(0);
    expect(pred.modelConfig.nTeams).toBeGreaterThan(15);
  });

  it('3. Verifies zero leakage across a continuous walk-forward batch of 100 historical matches', async () => {
    const matches = await StrictWalkForwardAdapter.loadCanonicalMatches();
    // Select 100 consecutive matches across 2017-2018 season
    const cohort = matches.filter((m) => m.season === '2017-2018').slice(0, 100);

    const predictions = await StrictWalkForwardAdapter.executeWalkForwardCohort(cohort);
    expect(predictions.length).toBe(100);

    for (const pred of predictions) {
      // 1. Prediction timestamp < Kickoff timestamp
      const pT = new Date(pred.predictionTimestamp).getTime();
      const kT = new Date(pred.kickoffTimestamp).getTime();
      expect(pT).toBeLessThan(kT);

      // 2. Training cutoff <= Kickoff date
      expect(pred.trainingCutoffDate <= pred.kickoffDate).toBe(true);

      // 3. Last training match date strictly prior to kickoff date
      if (pred.lastTrainingMatchDate !== null) {
        expect(pred.lastTrainingMatchDate < pred.kickoffDate).toBe(true);
      }
    }
  });
});

