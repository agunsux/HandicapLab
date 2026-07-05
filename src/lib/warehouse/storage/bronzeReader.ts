import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { IObjectStorage } from './storage.interface';

export class BronzeReader {
  private readonly storage: IObjectStorage;

  constructor(storage: IObjectStorage) {
    this.storage = storage;
  }

  private calculateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async decompressGzip(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      zlib.gunzip(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(result.toString('utf-8'));
      });
    });
  }

  /**
   * Reads, verifies, and parses a compressed Bronze layer file.
   */
  public async read(key: string, expectedChecksum?: string): Promise<any> {
    const rawBuffer = await this.storage.download(key);
    const rawJsonStr = await this.decompressGzip(rawBuffer);

    // Verify SHA-256 Checksum if provided
    if (expectedChecksum) {
      const calculated = this.calculateHash(rawJsonStr);
      if (calculated !== expectedChecksum) {
        throw new Error(`[BronzeReader] Checksum mismatch for ${key}. Expected: ${expectedChecksum}, Calculated: ${calculated}`);
      }
    }

    return JSON.parse(rawJsonStr);
  }
}
