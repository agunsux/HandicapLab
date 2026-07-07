// HandicapLab Live Data Platform - Parquet Helper
// Location: src/lib/data-platform/parquetHelper.ts

import * as fs from 'fs';
import * as path from 'path';

import { DuckDBAdapter } from './duckdbAdapter';

export class ParquetHelper {
  
  /**
   * Reads a native parquet file into an array of objects using DuckDB.
   */
  public static async read(filePath: string): Promise<any[]> {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const db = new DuckDBAdapter();
    try {
      const rows = await db.query(`SELECT * FROM read_parquet('${filePath}')`);
      return rows;
    } finally {
      await db.close();
    }
  }

  /**
   * Given an array of JSON objects, writes them to a native Parquet file via DuckDB.
   */
  public static async write(filePath: string, rows: any[]): Promise<void> {
    if (rows.length === 0) return;
    
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Write temp JSON file then ingest to parquet
    const tempJsonPath = filePath + '.temp.json';
    fs.writeFileSync(tempJsonPath, rows.map(r => JSON.stringify(r)).join('\n'));

    const db = new DuckDBAdapter();
    try {
      await db.exec(`COPY (SELECT * FROM read_json_auto('${tempJsonPath}')) TO '${filePath}' (FORMAT PARQUET)`);
    } finally {
      await db.close();
      if (fs.existsSync(tempJsonPath)) {
        fs.unlinkSync(tempJsonPath);
      }
    }
  }
}
