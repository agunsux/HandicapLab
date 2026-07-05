import { FootballDataImporter } from '../providers/football-data/FootballDataImporter';
import { IngestionSummary } from '../core/interfaces/MatchDataImporter';

export class ImportService {
  private readonly importer: FootballDataImporter;

  constructor() {
    this.importer = new FootballDataImporter();
  }

  /**
   * Orchestrates the parsing, staging, and import updates.
   */
  public async processCSV(csvContent: string): Promise<IngestionSummary> {
    console.log('[ImportService] Starting CSV import job...');
    const summary = await this.importer.importCSV(csvContent);
    console.log('[ImportService] CSV Ingestion completed successfully.');
    return summary;
  }
}
