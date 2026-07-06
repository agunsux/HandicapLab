import { IDataProvider } from './dataProvider.interface';
import { IObjectStorage } from '../storage/storage.interface';
import { BronzeWriter } from '../storage/bronzeWriter';
import { CheckpointService, CheckpointModel } from './checkpoint';
import { FixtureValidator, OddsSnapshotValidator, ValidationReport } from './validation';
import { LEAGUE_REGISTRY } from '../../crons/leagueRegistry';

export interface ImportConfig {
  provider: string;
  league: string;
  season: number;
  endpoint: 'fixtures' | 'odds';
  pageSize?: number;
  maxRetries?: number;
  rateLimitDelayMs?: number;
  dryRun?: boolean;
}

export class HistoricalImportService {
  private readonly provider: IDataProvider;
  private readonly storage: IObjectStorage;
  private readonly checkpointService: CheckpointService;
  private readonly bronzeWriter: BronzeWriter;

  constructor(
    provider: IDataProvider,
    storage: IObjectStorage,
    checkpointService?: CheckpointService
  ) {
    this.provider = provider;
    this.storage = storage;
    this.checkpointService = checkpointService || new CheckpointService();
    this.bronzeWriter = new BronzeWriter(this.storage);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async runImport(config: ImportConfig): Promise<CheckpointModel> {
    const {
      provider: providerName,
      league,
      season,
      endpoint,
      pageSize = 50,
      maxRetries = 3,
      rateLimitDelayMs = 100,
      dryRun = false
    } = config;

    const importId = `${providerName}-${league}-${season}-${endpoint}`;
    console.log(`[ImportService] Starting session ${importId}. Dry Run: ${dryRun}`);

    // 1. Resume / Initialize Checkpoint
    let checkpoint: CheckpointModel;
    if (dryRun) {
      checkpoint = {
        provider: providerName,
        league,
        season,
        endpoint,
        status: 'running',
        page: 1,
        rows_imported: 0,
        rows_skipped: 0,
        rows_failed: 0
      };
    } else {
      checkpoint = await this.checkpointService.resume(providerName, league, season, endpoint);
    }

    if (checkpoint.status === 'completed') {
      console.log(`[ImportService] Session ${importId} is already completed. Skipping.`);
      return checkpoint;
    }

    try {
      // 2. Fetch raw source payload
      // In a real paginated endpoint, we would query page-by-page.
      // Here we fetch the full canonical arrays and page them locally to align with our IDataProvider interface.
      let allItems: any[] = [];
      const startTime = Date.now();

      let retryAttempts = 0;
      while (retryAttempts <= maxRetries) {
        try {
          if (endpoint === 'fixtures') {
            const config = LEAGUE_REGISTRY.find(
              l => l.id.toLowerCase() === league.toLowerCase() ||
                   l.name.toLowerCase() === league.toLowerCase()
            );
            const competitionId = config ? config.apiFootballId : 39;
            allItems = await this.provider.getFixtures(competitionId, season);
          } else {
            // Odds snapshots require checking specific fixtures
            allItems = await this.provider.getOddsSnapshots(1001); // Mock fixture ID
          }
          break;
        } catch (err: any) {
          retryAttempts++;
          if (retryAttempts > maxRetries) throw err;
          console.warn(`[ImportService] Ingestion attempt failed. Retrying in ${rateLimitDelayMs * 2}ms...`);
          await this.sleep(rateLimitDelayMs * 2);
        }
      }

      const totalItems = allItems.length;
      const totalPages = Math.ceil(totalItems / pageSize);
      let currentPage = checkpoint.page || 1;

      console.log(`[ImportService] Fetched ${totalItems} items. Total pages to process: ${totalPages}. Starting at page ${currentPage}`);

      const fixtureValidator = new FixtureValidator();
      const oddsValidator = new OddsSnapshotValidator();
      const report = new ValidationReport();

      // 3. Process page-by-page
      while (currentPage <= totalPages) {
        const pageSlice = allItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
        
        // Validation step
        for (const item of pageSlice) {
          if (endpoint === 'fixtures') {
            report.addRecords(item.apiId, fixtureValidator.validate(item));
          } else {
            report.addRecords(item.fixtureId, oddsValidator.validate(item));
          }
        }

        const summary = report.getSummary();
        checkpoint.rows_failed = summary.totalErrors;
        checkpoint.rows_skipped = summary.totalWarnings;
        checkpoint.rows_imported = summary.totalValidated - summary.totalFailed;

        // Write page slice to Bronze raw storage
        if (!dryRun && pageSlice.length > 0) {
          await this.bronzeWriter.write({
            provider: providerName,
            league,
            season,
            endpoint,
            rawData: pageSlice,
            customMetadata: { page: currentPage, totalPages }
          });
        }

        // Throttle
        await this.sleep(rateLimitDelayMs);

        // Update progress checkpoint
        currentPage++;
        checkpoint.page = currentPage;
        checkpoint.updated_at = new Date().toISOString();

        if (!dryRun) {
          checkpoint = await this.checkpointService.resume(providerName, league, season, endpoint);
          // Manually update running progress parameters
          checkpoint.page = currentPage;
          checkpoint.rows_imported = checkpoint.rows_imported;
          checkpoint.rows_failed = checkpoint.rows_failed;
        }

        // Structured log output
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        const estRemaining = totalPages - currentPage >= 0 
          ? ((totalPages - currentPage) * (rateLimitDelayMs / 1000)).toFixed(1)
          : '0.0';

        console.log(
          `[ImportLog] ID: ${importId} | Page: ${currentPage - 1}/${totalPages} | ` +
          `Imported: ${checkpoint.rows_imported} | Failed: ${checkpoint.rows_failed} | ` +
          `Elapsed: ${elapsedSec}s | Rem: ${estRemaining}s`
        );
      }

      // 4. Mark Completed
      if (!dryRun) {
        checkpoint = await this.checkpointService.markCompleted(providerName, league, season, endpoint);
      } else {
        checkpoint.status = 'completed';
        checkpoint.completed_at = new Date().toISOString();
      }

      console.log(`[ImportService] Session ${importId} successfully finished.`);
      return checkpoint;

    } catch (err: any) {
      console.error(`[ImportService] Critical pipeline crash in session ${importId}:`, err.message);
      if (!dryRun) {
        checkpoint = await this.checkpointService.markFailed(providerName, league, season, endpoint, err.message);
      } else {
        checkpoint.status = 'failed';
        checkpoint.last_error = err.message;
      }
      throw err;
    }
  }
}
