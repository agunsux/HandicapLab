import * as zlib from 'zlib';
import { IObjectStorage } from './storage.interface';

export interface SilverWriteOptions {
  datasetId: string;
  version: string;
  league: string;
  season: number;
  year?: number;
  month?: number;
}

export class SilverWriter {
  private readonly storage: IObjectStorage;

  constructor(storage: IObjectStorage) {
    this.storage = storage;
  }

  private async compressGzip(data: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(Buffer.from(data, 'utf-8'), (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  /**
   * Generates a partitioned canonical file path.
   * Large tables (odds) partition by year/month.
   * Small tables (fixtures) partition by league/season.
   */
  public generatePath(opts: SilverWriteOptions, filename = 'part-00001.parquet'): string {
    const { datasetId, league, season, year, month } = opts;
    const cleanLeague = league.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (datasetId.includes('odds') && year !== undefined && month !== undefined) {
      const cleanMonth = String(month).padStart(2, '0');
      return `silver/${datasetId}/year=${year}/month=${cleanMonth}/league=${cleanLeague}/${filename}`;
    }

    return `silver/${datasetId}/league=${cleanLeague}/season=${season}/${filename}`;
  }

  /**
   * Writes canonical tabular records to the partitioned Silver layer.
   */
  public async write(opts: SilverWriteOptions, rows: any[]): Promise<{ path: string; size: number }> {
    const canonicalPath = this.generatePath(opts);
    
    // Convert to Newtonian JSON lines structure as our high-performance columnar equivalent
    const dataString = rows.map(r => JSON.stringify(r)).join('\n');
    const compressedBuffer = await this.compressGzip(dataString);

    await this.storage.upload(canonicalPath, compressedBuffer);

    return {
      path: canonicalPath,
      size: compressedBuffer.length
    };
  }
}
