import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TeamRegistry } from '../../src/infrastructure/registry/team-registry';
import { CompetitionRegistry } from '../../src/infrastructure/registry/competition-registry';
import { CanonicalMergeEngine } from '../../src/application/data/merge-engine';
import { DataQualityEngine } from '../../src/application/data/quality-engine';
import { FootballDataCSVProvider } from '../../src/infrastructure/provider/football-data-csv-provider';
import { UnderstatProvider } from '../../src/infrastructure/provider/understat-provider';
import { FileFixtureRepository } from '../../src/infrastructure/repository/fixture-repository';
import { FileOddsRepository } from '../../src/infrastructure/repository/odds-repository';
import { FileTeamRepository } from '../../src/infrastructure/repository/team-repository';
import { FileCompetitionRepository } from '../../src/infrastructure/repository/competition-repository';
import { FileDatasetRepository } from '../../src/infrastructure/repository/dataset-repository';
import { FileGoldenDatasetRepository } from '../../src/infrastructure/repository/golden-dataset-repository';
import { CanonicalFixture, CanonicalOdds } from '../../src/domain/dataset/canonical';

describe('EPIC 31B.6 — Historical Data Platform Tests', () => {
  beforeEach(() => {
    // Clear directories or files if needed
  });

  describe('Registries Normalization', () => {
    it('should resolve various spellings to canonical team IDs', () => {
      expect(TeamRegistry.resolve('Man United')).toBe('manchesterunited');
      expect(TeamRegistry.resolve('Manchester Utd')).toBe('manchesterunited');
      expect(TeamRegistry.resolve('Man City')).toBe('manchestercity');
      expect(TeamRegistry.resolve('Arsenal FC')).toBe('arsenal');
      expect(TeamRegistry.resolve('Spurs')).toBe('tottenham');
    });

    it('should resolve leagues to competition IDs', () => {
      expect(CompetitionRegistry.resolve('Premier League')).toBe('EPL');
      expect(CompetitionRegistry.resolve('La Liga')).toBe('SP1');
      expect(CompetitionRegistry.resolve('Serie A')).toBe('IT1');
    });
  });

  describe('Data Providers', () => {
    it('should return fixtures and odds with correct structures', async () => {
      const csvProvider = new FootballDataCSVProvider();
      const understatProvider = new UnderstatProvider();

      const fixtures = await csvProvider.fetchFixtures('EPL', '2023-2024');
      const odds = await csvProvider.fetchOdds('EPL', '2023-2024');
      const understatFixtures = await understatProvider.fetchFixtures('EPL', '2023-2024');

      expect(fixtures.length).toBeGreaterThan(0);
      expect(odds.length).toBeGreaterThan(0);
      expect(understatFixtures.length).toBeGreaterThan(0);

      const f = fixtures[0];
      expect(f.fixtureId).toBeDefined();
      expect(f.fixtureNaturalKey).toBeDefined();
      expect(f.homeTeamId).toBeDefined();
      expect(f.awayTeamId).toBeDefined();
      expect(f.kickoff?.value).toBeDefined();
      expect(f.homeGoals?.value).toBeDefined();

      const u = understatFixtures[0];
      expect(u.homeXg?.value).toBeGreaterThan(0);
      expect(u.awayXg?.value).toBeGreaterThan(0);
    });
  });

  describe('Merge Engine and Conflict Resolution', () => {
    it('should resolve conflicts and track provenance details', () => {
      const mergeEngine = new CanonicalMergeEngine();
      
      const naturalKey = 'EPL|2023-2024|ARSENAL|CHELSEA|2023-10-08';
      const fixtureId = 'test-fxt-id';
      
      const candidates = [
        {
          provider: 'football-data.co.uk',
          providerVersion: '1.0',
          data: {
            homeGoals: { value: 3, source: 'football-data.co.uk', confidence: 0.999, mergeReason: 'highest_confidence' as const },
            awayGoals: { value: 1, source: 'football-data.co.uk', confidence: 0.999, mergeReason: 'highest_confidence' as const },
            referee: { value: 'M Oliver', source: 'football-data.co.uk', confidence: 0.97, mergeReason: 'highest_confidence' as const }
          }
        },
        {
          provider: 'understat',
          providerVersion: '1.0',
          data: {
            homeGoals: { value: 2, source: 'understat', confidence: 0.80, mergeReason: 'highest_confidence' as const }, // different goals value!
            awayGoals: { value: 1, source: 'understat', confidence: 0.80, mergeReason: 'highest_confidence' as const },
            homeXg: { value: 2.15, source: 'understat', confidence: 0.995, mergeReason: 'highest_confidence' as const },
            awayXg: { value: 0.85, source: 'understat', confidence: 0.995, mergeReason: 'highest_confidence' as const }
          }
        }
      ];

      const merged = mergeEngine.merge(naturalKey, fixtureId, 'EPL', '2023-2024', 'arsenal', 'chelsea', candidates);

      // Home goals should select football-data.co.uk (3) over understat (2) because of higher confidence (0.999 > 0.80)
      expect(merged.homeGoals.value).toBe(3);
      expect(merged.homeGoals.source).toBe('football-data.co.uk');
      expect(merged.homeGoals.confidence).toBe(0.999);

      // Expected goals should map Understat
      expect(merged.homeXg.value).toBe(2.15);
      expect(merged.homeXg.source).toBe('understat');

      // Conflict should be logged
      const conflicts = mergeEngine.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].field).toBe('goals');
      expect(conflicts[0].selectedValue).toBe(3);
      expect(conflicts[0].selectedProvider).toBe('football-data.co.uk');
    });
  });

  describe('Data Quality Scoring', () => {
    it('should calculate valid percentages and score', () => {
      const fixtures: CanonicalFixture[] = [
        {
          fixtureId: 'f1',
          fixtureNaturalKey: 'EPL|2023-2024|ARS|CHE|2023-10-08',
          competitionId: 'EPL',
          seasonId: '2023-2024',
          homeTeamId: 'arsenal',
          awayTeamId: 'chelsea',
          kickoff: { value: '2023-10-08T15:00:00Z', source: 'test', confidence: 1, mergeReason: 'highest_confidence' },
          homeGoals: { value: 2, source: 'test', confidence: 1, mergeReason: 'highest_confidence' },
          awayGoals: { value: 1, source: 'test', confidence: 1, mergeReason: 'highest_confidence' },
          homeXg: { value: 1.85, source: 'test', confidence: 1, mergeReason: 'highest_confidence' },
          awayXg: { value: 0.95, source: 'test', confidence: 1, mergeReason: 'highest_confidence' },
          homeShots: { value: 12, source: 'test', confidence: 1, mergeReason: 'highest_confidence' },
          awayShots: { value: 8, source: 'test', confidence: 1, mergeReason: 'highest_confidence' },
          homeShotsOnTarget: { value: 6, source: 'test', confidence: 1, mergeReason: 'highest_confidence' },
          awayShotsOnTarget: { value: 4, source: 'test', confidence: 1, mergeReason: 'highest_confidence' },
          referee: { value: 'M Oliver', source: 'test', confidence: 1, mergeReason: 'highest_confidence' },
          regime: { value: 'FullCrowd_Normal', source: 'test', confidence: 1, mergeReason: 'highest_confidence' },
          qualityScore: 100,
          schemaVersion: 1,
          datasetVersion: 6,
          lineage: [],
          generatedAt: new Date().toISOString()
        }
      ];

      const odds: CanonicalOdds[] = [
        {
          fixtureId: 'f1',
          provider: 'Pinnacle',
          marketType: 'ML',
          selection: 'home',
          oddsDecimal: 1.85,
          impliedProbability: 1 / 1.85,
          fairProbability: 1 / 1.85,
          margin: 0.0,
          receivedAt: '2023-10-08T15:00:00Z',
          processedTimestamp: '2023-10-08T15:00:00Z'
        }
      ];

      const report = DataQualityEngine.evaluate(fixtures, odds, 0);
      expect(report.overallScore).toBeGreaterThanOrEqual(95);
      expect(report.duplicateCount).toBe(0);
      expect(report.missingOddsCount).toBe(0);
    });
  });

  describe('Repositories Data Contracts', () => {
    it('should implement all repository contracts correctly', async () => {
      const fixtureRepo = new FileFixtureRepository();
      const oddsRepo = new FileOddsRepository();
      const teamRepo = new FileTeamRepository();
      const compRepo = new FileCompetitionRepository();
      const datasetRepo = new FileDatasetRepository();
      const goldenRepo = new FileGoldenDatasetRepository();

      expect(fixtureRepo.save).toBeDefined();
      expect(oddsRepo.saveOdds).toBeDefined();
      expect(teamRepo.save).toBeDefined();
      expect(compRepo.save).toBeDefined();
      expect(datasetRepo.saveManifest).toBeDefined();
      expect(goldenRepo.saveGoldenFixtures).toBeDefined();
    });
  });
});
