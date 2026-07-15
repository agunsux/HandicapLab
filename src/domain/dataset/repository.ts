import {
  CanonicalFixture,
  CanonicalOdds,
  CanonicalTeam,
  CanonicalCompetition,
  DatasetState
} from './canonical';

export interface FixtureRepository {
  save(fixture: CanonicalFixture): Promise<void>;
  findById(fixtureId: string): Promise<CanonicalFixture | null>;
  findByNaturalKey(naturalKey: string): Promise<CanonicalFixture | null>;
  listAll(): Promise<CanonicalFixture[]>;
  findBySeason(competitionId: string, seasonId: string): Promise<CanonicalFixture[]>;
}

export interface OddsRepository {
  saveOdds(odds: CanonicalOdds[]): Promise<void>;
  findByFixtureId(fixtureId: string): Promise<CanonicalOdds[]>;
  listAll(): Promise<CanonicalOdds[]>;
}

export interface TeamRepository {
  save(team: CanonicalTeam): Promise<void>;
  findById(id: string): Promise<CanonicalTeam | null>;
  findByNameOrAlias(name: string): Promise<CanonicalTeam | null>;
  listAll(): Promise<CanonicalTeam[]>;
}

export interface CompetitionRepository {
  save(competition: CanonicalCompetition): Promise<void>;
  findById(id: string): Promise<CanonicalCompetition | null>;
  listAll(): Promise<CanonicalCompetition[]>;
}

export interface DatasetManifest {
  datasetVersion: number;
  schemaVersion: number;
  fixtureCount: number;
  providerCount: number;
  providerVersions: Record<string, string>;
  qualityScore: number;
  checksum: string;
  createdAt: string;
  gitCommit: string;
  state: DatasetState;
}

export interface DatasetRepository {
  saveManifest(manifest: DatasetManifest): Promise<void>;
  getManifest(version: number): Promise<DatasetManifest | null>;
  getCurrentVersion(): Promise<number>;
  freezeVersion(version: number, manifest: DatasetManifest): Promise<void>;
}

export interface GoldenDatasetRepository {
  saveGoldenFixtures(fixtures: CanonicalFixture[]): Promise<void>;
  getGoldenFixtures(): Promise<CanonicalFixture[]>;
  verifyCategoryBalance(categories: Record<string, number>): Promise<{
    passed: boolean;
    counts: Record<string, number>;
    errors: string[];
  }>;
}
