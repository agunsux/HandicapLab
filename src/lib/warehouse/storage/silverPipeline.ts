import { BronzeReader } from './bronzeReader';
import { SilverWriter, SilverWriteOptions } from './silverWriter';
import { DeduplicationEngine, DeduplicationStrategy } from './deduplication';
import { EntityResolver } from '../metadata/entityResolver';
import { DataContractValidator, DataContractDefinition } from '../metadata/dataContract';
import { MetadataRegistry } from '../metadata/registry';
import { IObjectStorage } from './storage.interface';

export interface PipelineConfig {
  bronzeKey: string;
  expectedChecksum?: string;
  dedupStrategy?: DeduplicationStrategy;
  contract: DataContractDefinition;
  provider: string;
  league: string;
  season: number;
  year?: number;
  month?: number;
}

export interface QualityReport {
  processed: number;
  resolved: number;
  deduplicated: number;
  rejected: number;
  errors: string[];
}

export class SilverPipeline {
  private readonly bronzeReader: BronzeReader;
  private readonly silverWriter: SilverWriter;
  private readonly entityResolver: EntityResolver;
  private readonly metadataRegistry: MetadataRegistry;

  constructor(storage: IObjectStorage, registry?: MetadataRegistry) {
    this.bronzeReader = new BronzeReader(storage);
    this.silverWriter = new SilverWriter(storage);
    this.metadataRegistry = registry || new MetadataRegistry();
    this.entityResolver = new EntityResolver(this.metadataRegistry);
  }

  public async execute(config: PipelineConfig): Promise<{ path: string; report: QualityReport }> {
    const report: QualityReport = {
      processed: 0,
      resolved: 0,
      deduplicated: 0,
      rejected: 0,
      errors: []
    };

    // 1. Read & Decompress Bronze Raw Payload
    const rawData = await this.bronzeReader.read(config.bronzeKey, config.expectedChecksum);
    
    // Normalize into array if single block
    const items = Array.isArray(rawData) ? rawData : [rawData];
    report.processed = items.length;

    const resolvedItems: any[] = [];

    // 2. Entity Resolution & Normalization Cascades
    for (const rawItem of items) {
      try {
        let canonicalId: number | null = null;

        // Resolve Teams/Competitions context mapping
        if (rawItem.homeTeamName) {
          const resolvedHome = await this.entityResolver.resolveTeam(
            config.provider,
            rawItem.homeTeamApiId || String(rawItem.homeTeamId || ''),
            rawItem.homeTeamName
          );
          if (resolvedHome.canonicalId) {
            canonicalId = resolvedHome.canonicalId;
            report.resolved++;
          }
        }

        // Attach integer surrogate identifiers and clean timestamps
        const normalizedItem = {
          ...rawItem,
          fixture_id: rawItem.fixture_id || rawItem.apiId || Date.now(),
          status: (rawItem.status || 'scheduled').toLowerCase(),
          kickoff_time: rawItem.kickoff_time || rawItem.kickoffTime || new Date().toISOString(),
          canonical_team_id: canonicalId
        };

        resolvedItems.push(normalizedItem);
      } catch (err: any) {
        report.rejected++;
        report.errors.push(`Resolution error: ${err.message}`);
      }
    }

    // 3. Deduplication Engine Filtering
    const dedupKey = (item: any) => String(item.fixture_id || item.id || '');
    const { deduplicated, duplicateCount } = DeduplicationEngine.deduplicate(
      resolvedItems,
      dedupKey,
      config.dedupStrategy || 'KEEP_FIRST'
    );
    report.deduplicated = duplicateCount;

    // 4. Contract Schema Validation
    const validator = new DataContractValidator(config.contract);
    const validRows: any[] = [];

    for (const row of deduplicated) {
      const contractErrors = validator.validateRow(row);
      if (contractErrors.length > 0) {
        report.rejected++;
        report.errors.push(...contractErrors);
      } else {
        validRows.push(row);
      }
    }

    // 5. Partitioned Silver Write
    const writeOpts: SilverWriteOptions = {
      datasetId: config.contract.datasetId,
      version: config.contract.version,
      league: config.league,
      season: config.season,
      year: config.year,
      month: config.month
    };

    const { path, size } = await this.silverWriter.write(writeOpts, validRows);

    // 6. Register Metadata Snapshot
    await this.metadataRegistry.registerDataset({
      datasetId: config.contract.datasetId,
      version: config.contract.version,
      schemaDefinition: config.contract,
      checksum: config.expectedChecksum || 'dynamic_checksum',
      compression: 'gzip',
      rowCount: validRows.length,
      provider: config.provider,
      coveragePct: report.processed > 0 ? Number(((validRows.length / report.processed) * 100).toFixed(2)) : 0
    });

    return { path, report };
  }
}
