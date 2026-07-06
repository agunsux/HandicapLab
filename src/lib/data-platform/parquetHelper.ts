// HandicapLab Live Data Platform - Parquet Helper
// Location: src/lib/data-platform/parquetHelper.ts

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export class ParquetHelper {
  /**
   * Serializes rows as Newtonian JSON lines, Gzips the output, and writes to a .parquet file.
   */
  public static writeSync(filePath: string, rows: any[]): void {
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    const jsonlString = rows.map((r) => JSON.stringify(r)).join('\n');
    const compressedBuffer = zlib.gzipSync(Buffer.from(jsonlString, 'utf-8'));
    fs.writeFileSync(filePath, compressedBuffer);
  }

  /**
   * Reads a .parquet file, decompresses it via Gzip, and parses the Newtonian JSON lines back to rows.
   */
  public static readSync(filePath: string): any[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const compressedBuffer = fs.readFileSync(filePath);
    const decompressedString = zlib.gunzipSync(compressedBuffer).toString('utf-8');
    if (!decompressedString.trim()) {
      return [];
    }
    return decompressedString
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  }

  /**
   * Serializes rows as Newtonian JSON lines, Gzips the output, and writes to a .parquet file asynchronously.
   */
  public static async write(filePath: string, rows: any[]): Promise<void> {
    const parentDir = path.dirname(filePath);
    await fs.promises.mkdir(parentDir, { recursive: true });
    const jsonlString = rows.map((r) => JSON.stringify(r)).join('\n');
    return new Promise((resolve, reject) => {
      zlib.gzip(Buffer.from(jsonlString, 'utf-8'), (err, result) => {
        if (err) {
          reject(err);
        } else {
          fs.promises.writeFile(filePath, result)
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  /**
   * Reads a .parquet file, decompresses it via Gzip, and parses the Newtonian JSON lines back to rows asynchronously.
   */
  public static async read(filePath: string): Promise<any[]> {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const compressedBuffer = await fs.promises.readFile(filePath);
    return new Promise((resolve, reject) => {
      zlib.gunzip(compressedBuffer, (err, result) => {
        if (err) {
          reject(err);
        } else {
          const decompressedString = result.toString('utf-8');
          if (!decompressedString.trim()) {
            resolve([]);
          } else {
            try {
              const rows = decompressedString
                .split('\n')
                .filter((line) => line.trim().length > 0)
                .map((line) => JSON.parse(line));
              resolve(rows);
            } catch (parseErr) {
              reject(parseErr);
            }
          }
        }
      });
    });
  }
}
