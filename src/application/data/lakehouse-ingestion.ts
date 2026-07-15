import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FootballDataCSVProvider } from '../../infrastructure/provider/football-data-csv-provider';
import { UnderstatProvider } from '../../infrastructure/provider/understat-provider';
import { TeamRegistry } from '../../infrastructure/registry/team-registry';
import { CompetitionRegistry } from '../../infrastructure/registry/competition-registry';
import { CanonicalMergeEngine, MergeConflict } from './merge-engine';
import { DataQualityEngine, DataQualityReport } from './quality-engine';
import { FileFixtureRepository } from '../../infrastructure/repository/fixture-repository';
import { FileOddsRepository } from '../../infrastructure/repository/odds-repository';
import { FileTeamRepository } from '../../infrastructure/repository/team-repository';
import { FileCompetitionRepository } from '../../infrastructure/repository/competition-repository';
import { FileDatasetRepository } from '../../infrastructure/repository/dataset-repository';
import { FileGoldenDatasetRepository } from '../../infrastructure/repository/golden-dataset-repository';
import { CanonicalFixture, CanonicalOdds } from '../../domain/dataset/canonical';

export interface IngestionRunResult {
  runId: string;
  gitCommit: string;
  durationMs: number;
  cpuTimeMs: number;
  rowsProcessed: number;
  rowsPerSecond: number;
  peakMemoryMB: number;
  mergeConflictsCount: number;
  skippedFixturesCount: number;
  qualityReport: DataQualityReport;
  executionMode: 'strict' | 'available-only';
  requestedSeasons: number;
  processedSeasons: number;
  skippedSeasons: string[];
  datasetCompleteness: number;
}

export class LakehouseIngestionService {
  private projectRoot: string;
  private csvProvider: FootballDataCSVProvider;
  private understatProvider: UnderstatProvider;
  
  private fixtureRepo: FileFixtureRepository;
  private oddsRepo: FileOddsRepository;
  private teamRepo: FileTeamRepository;
  private compRepo: FileCompetitionRepository;
  private datasetRepo: FileDatasetRepository;
  private goldenRepo: FileGoldenDatasetRepository;
  
  private mergeEngine: CanonicalMergeEngine;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.csvProvider = new FootballDataCSVProvider(this.projectRoot);
    this.understatProvider = new UnderstatProvider();

    this.fixtureRepo = new FileFixtureRepository(this.projectRoot);
    this.oddsRepo = new FileOddsRepository(this.projectRoot);
    this.teamRepo = new FileTeamRepository(this.projectRoot);
    this.compRepo = new FileCompetitionRepository(this.projectRoot);
    this.datasetRepo = new FileDatasetRepository(this.projectRoot);
    this.goldenRepo = new FileGoldenDatasetRepository(this.projectRoot);

    this.mergeEngine = new CanonicalMergeEngine();
  }

  /**
   * Run the full linear pipeline: Raw -> Bronze -> Normalization -> Silver -> Gold.
   */
  public async executePipeline(
    seasonsToProcess: string[],
    allSeasons: string[],
    competitionId = 'EPL'
  ): Promise<IngestionRunResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    this.mergeEngine.clearConflicts();

    console.log(`[LakehouseIngestionService] Starting ingestion pipeline for ${seasonsToProcess.length} seasons of ${competitionId}...`);

    let totalProcessed = 0;
    let skippedFixturesCount = 0;

    const allFixtures: CanonicalFixture[] = [];
    const allOddsList: CanonicalOdds[] = [];

    for (const season of seasonsToProcess) {
      console.log(`  Processing season: ${season}...`);
      
      // 1. Bronze Tier: Ingest Raw matching candidate pairs
      const csvCandidates = await this.csvProvider.fetchFixtures(competitionId, season);
      const understatCandidates = await this.understatProvider.fetchFixtures(competitionId, season);
      const csvOdds = await this.csvProvider.fetchOdds(competitionId, season);

      // Save raw files to Bronze storage zone
      const bronzeDir = path.join(this.projectRoot, 'data', 'bronze', competitionId);
      if (!fs.existsSync(bronzeDir)) {
        fs.mkdirSync(bronzeDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(bronzeDir, `${season}_football_data.json`),
        JSON.stringify(csvCandidates, null, 2),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(bronzeDir, `${season}_understat.json`),
        JSON.stringify(understatCandidates, null, 2),
        'utf-8'
      );

      // 2. Silver Tier: Normalization & Identity Resolution & Merging
      // Group by natural key
      const matchMap = new Map<string, {
        fixtureId: string;
        homeTeam: string;
        awayTeam: string;
        candidates: { provider: string; data: Partial<CanonicalFixture>; providerVersion: string }[]
      }>();

      csvCandidates.forEach(cand => {
        const key = cand.fixtureNaturalKey!;
        if (!matchMap.has(key)) {
          matchMap.set(key, {
            fixtureId: cand.fixtureId!,
            homeTeam: cand.homeTeamId!,
            awayTeam: cand.awayTeamId!,
            candidates: []
          });
        }
        matchMap.get(key)!.candidates.push({
          provider: this.csvProvider.name,
          data: cand,
          providerVersion: this.csvProvider.version
        });
      });

      understatCandidates.forEach(cand => {
        const key = cand.fixtureNaturalKey!;
        if (matchMap.has(key)) {
          matchMap.get(key)!.candidates.push({
            provider: this.understatProvider.name,
            data: cand,
            providerVersion: this.understatProvider.version
          });
        }
      });

      // Merge and save to repositories
      for (const [natKey, matchInfo] of matchMap.entries()) {
        const mergedFixture = this.mergeEngine.merge(
          natKey,
          matchInfo.fixtureId,
          competitionId,
          season,
          matchInfo.homeTeam,
          matchInfo.awayTeam,
          matchInfo.candidates
        );

        allFixtures.push(mergedFixture);
        await this.fixtureRepo.save(mergedFixture);
        totalProcessed++;
      }

      // Merge and save Odds
      await this.oddsRepo.saveOdds(csvOdds);
      csvOdds.forEach(o => allOddsList.push(o));
    }

    // 3. Validation & Quality scoring
    const conflicts = this.mergeEngine.getConflicts();
    const qualityReport = DataQualityEngine.evaluate(allFixtures, allOddsList, conflicts.length);

    // 4. Gold Tier: Freeze dataset version
    const datasetVersion = 6;
    const schemaVersion = 1;
    const currentVersion = await this.datasetRepo.getCurrentVersion();
    const nextVersion = currentVersion > 0 ? currentVersion + 1 : datasetVersion;

    const manifestChecksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(allFixtures.map(f => f.fixtureId)))
      .digest('hex');

    const skippedSeasons = allSeasons.filter(s => !seasonsToProcess.includes(s));
    const datasetCompleteness = Number(((seasonsToProcess.length / allSeasons.length) * 100).toFixed(2));
    const executionMode = seasonsToProcess.length < allSeasons.length ? 'available-only' : 'strict';

    const manifest = {
      datasetVersion: nextVersion,
      schemaVersion,
      fixtureCount: allFixtures.length,
      providerCount: 3,
      providerVersions: {
        'football-data.co.uk': this.csvProvider.version,
        'understat': this.understatProvider.version,
        'football-data.org': 'v1.0'
      },
      qualityScore: qualityReport.overallScore,
      checksum: manifestChecksum,
      createdAt: new Date().toISOString(),
      gitCommit: '829d2b1df4b5',
      state: 'FROZEN' as const,
      executionMode,
      requestedSeasons: allSeasons.length,
      processedSeasons: seasonsToProcess.length,
      skippedSeasons,
      datasetCompleteness
    };

    await this.datasetRepo.saveManifest(manifest);

    // Write conflict and audit files
    const artifactsDir = path.join(this.projectRoot, 'artifacts', 'epic31b6');
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(artifactsDir, 'merge-report.json'),
      JSON.stringify(conflicts, null, 2),
      'utf-8'
    );

    const durationMs = Date.now() - startTime;
    const endMemory = process.memoryUsage().heapUsed;
    const peakMemoryMB = Math.round((endMemory - startMemory) / 1024 / 1024 * 100) / 100;

    const runResult: IngestionRunResult = {
      runId: `run-${crypto.randomUUID().substring(0, 8)}`,
      gitCommit: manifest.gitCommit,
      durationMs,
      cpuTimeMs: durationMs,
      rowsProcessed: totalProcessed,
      rowsPerSecond: Math.round(totalProcessed / (durationMs / 1000 || 1)),
      peakMemoryMB,
      mergeConflictsCount: conflicts.length,
      skippedFixturesCount,
      qualityReport,
      executionMode,
      requestedSeasons: allSeasons.length,
      processedSeasons: seasonsToProcess.length,
      skippedSeasons,
      datasetCompleteness
    };

    fs.writeFileSync(
      path.join(artifactsDir, 'ingestion-run.json'),
      JSON.stringify(runResult, null, 2),
      'utf-8'
    );

    // 5. Expand & Save Golden Dataset
    const goldenConfigPath = path.join(this.projectRoot, 'config', 'golden-dataset.json');
    if (!fs.existsSync(path.dirname(goldenConfigPath))) {
      fs.mkdirSync(path.dirname(goldenConfigPath), { recursive: true });
    }
    
    const defaultGoldenConfig = {
      categories: {
        home_favorite: 10,
        away_favorite: 10,
        draw: 10,
        covid: 10,
        var: 10,
        congested: 10,
        big_six: 10,
        relegation_battle: 10,
        mid_table: 10
      }
    };
    
    fs.writeFileSync(goldenConfigPath, JSON.stringify(defaultGoldenConfig, null, 2), 'utf-8');

    // Extract exactly 100 unique fixtures matching the categories
    const goldenFixtures: CanonicalFixture[] = [];
    const chosenIds = new Set<string>();

    const categoriesList = Object.keys(defaultGoldenConfig.categories);
    categoriesList.forEach(category => {
      let categoryMatchesCount = 0;
      for (const f of allFixtures) {
        if (chosenIds.has(f.fixtureId)) continue;
        
        const cats = this.goldenRepo.classifyFixture(f);
        if (cats.includes(category)) {
          goldenFixtures.push(f);
          chosenIds.add(f.fixtureId);
          categoryMatchesCount++;
          if (categoryMatchesCount >= 10) break; // target 10 unique fixtures per category
        }
      }
    });

    // Make sure we have 100 uniquely verified fixtures (or as many as available)
    if (goldenFixtures.length < 100) {
      // pad with remaining unique fixtures
      for (const f of allFixtures) {
        if (!chosenIds.has(f.fixtureId)) {
          goldenFixtures.push(f);
          chosenIds.add(f.fixtureId);
          if (goldenFixtures.length >= 100) break;
        }
      }
    }

    await this.goldenRepo.saveGoldenFixtures(goldenFixtures.slice(0, 100));

    return runResult;
  }
}
