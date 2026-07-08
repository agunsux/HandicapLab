import fs from 'fs';
import path from 'path';
import { ZodSchemaValidator } from '../validation/zodSchemaValidator';
import { MatchBusinessValidator } from '../validation/matchBusinessValidator';

export interface DatasetMetadata {
  provider: string;
  league: string;
  season: string;
  rows: number;
  checksum: string;
  updated_at: string;
  schema_name: string;
  schema_version: string;
}

export class DatasetBuilder {
  private static getConfig() {
    const configPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'config', 'data-platform.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    // Fallback
    return {
      paths: {
        silver: './data/silver',
        registry: './data/registry'
      }
    };
  }

  /**
   * Builds and partitions the dataset into the Silver Layer (Parquet).
   */
  public static async buildPartition(
    records: any[],
    leagueId: string,
    season: string,
    version: string,
    provider: string
  ): Promise<DatasetMetadata> {
    
    // 1. Fail-fast Schema & Business Validation
    const schemaValidator = new ZodSchemaValidator();
    const businessValidator = new MatchBusinessValidator();
    
    const schemaReport = schemaValidator.validateBatch(records);
    if (!schemaReport.isValid) {
      const fatalErrors = schemaReport.errors.filter(e => e.severity === 'FATAL').map(e => `${e.field}: ${e.message}`);
      throw new Error(`Schema Drift Detected! Validation failed: ${fatalErrors.join(', ')}`);
    }

    const businessReport = businessValidator.validateBatch(records);
    if (!businessReport.isValid) {
      const fatalErrors = businessReport.errors.filter(e => e.severity === 'FATAL').map(e => `${e.field}: ${e.message}`);
      throw new Error(`Business Logic Violation! Validation failed: ${fatalErrors.join(', ')}`);
    }

    const config = this.getConfig();
    const basePath = config.paths.silver;
    
    const partitionDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), basePath, leagueId, season, version);
    if (!fs.existsSync(partitionDir)) {
      fs.mkdirSync(partitionDir, { recursive: true });
    }
    
    const parquetPath = path.join(partitionDir, 'dataset.parquet');

    // 2. Dump temp JSON to use DuckDB for Parquet creation
    const tempJsonPath = path.join(partitionDir, 'temp.json');
    fs.writeFileSync(tempJsonPath, records.map(r => JSON.stringify(r)).join('\n'));

    try {
      // Dynamic require to avoid Next.js Turbopack crashing on duckdb native module
      const { DuckDBAdapter } = eval(`require('./duckdbAdapter')`);
      const db = new DuckDBAdapter();
      try {
        await db.exec(`COPY (SELECT * FROM read_json_auto('${tempJsonPath.replace(/\\/g, '/')}')) TO '${parquetPath.replace(/\\/g, '/')}' (FORMAT PARQUET)`);
      } finally {
        await db.close();
      }
    } catch (e) {
      console.warn('DuckDBAdapter could not be loaded, skipping parquet creation.', e);
    } finally {
      if (fs.existsSync(tempJsonPath)) {
        fs.unlinkSync(tempJsonPath);
      }
    }

    // 3. Generate Checksum & Metadata
    const checksum = "chk_" + Date.now().toString(16); // mock checksum
    
    const metadata: DatasetMetadata = {
      provider,
      league: leagueId,
      season,
      rows: records.length,
      checksum,
      updated_at: new Date().toISOString(),
      schema_name: schemaValidator.schemaName,
      schema_version: schemaValidator.schemaVersion
    };
    
    // 4. Update the centralized registry
    this.updateRegistry(metadata);
    
    return metadata;
  }

  private static updateRegistry(metadata: DatasetMetadata) {
    const config = this.getConfig();
    const registryPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), config.paths.registry, 'dataset_metadata.json');
    const dir = path.dirname(registryPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let existing: DatasetMetadata[] = [];
    if (fs.existsSync(registryPath)) {
      existing = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    }
    
    // Replace old metadata for same partition
    existing = existing.filter(e => !(e.league === metadata.league && e.season === metadata.season && e.provider === metadata.provider));
    existing.push(metadata);
    
    fs.writeFileSync(registryPath, JSON.stringify(existing, null, 2), 'utf8');
  }

  public static getDatasets(): DatasetMetadata[] {
    const config = this.getConfig();
    const registryPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), config.paths.registry, 'dataset_metadata.json');
    if (fs.existsSync(registryPath)) {
      return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    }
    return [];
  }
}
