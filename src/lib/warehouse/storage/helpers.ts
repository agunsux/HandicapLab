import * as crypto from 'crypto';

export class StorageHelpers {
  /**
   * Generates a canonical Bronze folder path.
   * Format: bronze/{provider}/{league}/{season}/{date}/raw.json
   */
  public static getBronzePath(provider: string, league: string, season: number, date: string): string {
    const cleanProvider = provider.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLeague = league.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `bronze/${cleanProvider}/${cleanLeague}/${season}/${date}/raw.json`;
  }

  /**
   * Generates a canonical Silver folder path.
   * Format: silver/{league}/{season}/{date}/cleaned.parquet
   */
  public static getSilverPath(league: string, season: number, date: string): string {
    const cleanLeague = league.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `silver/${cleanLeague}/${season}/${date}/cleaned.parquet`;
  }

  /**
   * Generates a canonical Gold folder path.
   * Format: gold/{market}/{date}/consensus.parquet
   */
  public static getGoldPath(market: string, date: string): string {
    const cleanMarket = market.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `gold/${cleanMarket}/${date}/consensus.parquet`;
  }

  /**
   * Generates a canonical Research folder path.
   */
  public static getResearchPath(hypothesisId: string, datasetVersion: string): string {
    return `research/${hypothesisId}/${datasetVersion}/run.parquet`;
  }

  /**
   * Generates a canonical Prediction folder path.
   */
  public static getPredictionPath(modelId: string, date: string): string {
    return `prediction/${modelId}/${date}/predictions.parquet`;
  }

  /**
   * Generates a SHA256 checksum string from a buffer.
   */
  public static sha256(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
