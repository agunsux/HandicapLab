// HandicapLab Live Data Platform - Storage Zones
// Location: src/lib/data-platform/storageZones.ts

import fs from 'fs';
import path from 'path';

export class StorageZones {
  private static baseDir = 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\b0e51ad4-db7e-4196-9e0e-e58ff37caeeb\\artifacts\\data-platform';

  private static getZonePath(zone: 'raw' | 'normalized' | 'curated'): string {
    return path.join(this.baseDir, zone);
  }

  private static ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Writes raw API response logs to the Raw Zone.
   */
  public static writeRaw(filename: string, content: any): void {
    const dir = this.getZonePath('raw');
    this.ensureDir(dir);
    fs.writeFileSync(
      path.join(dir, filename),
      JSON.stringify({ receivedAt: new Date().toISOString(), payload: content }, null, 2),
      'utf8'
    );
  }

  /**
   * Writes Canonical Data Models to the Normalized Zone.
   */
  public static writeNormalized(filename: string, content: any): void {
    const dir = this.getZonePath('normalized');
    this.ensureDir(dir);
    fs.writeFileSync(path.join(dir, filename), JSON.stringify(content, null, 2), 'utf8');
  }

  /**
   * Writes versioned Feature Store collections to the Curated Zone.
   */
  public static writeCurated(filename: string, content: any): void {
    const dir = this.getZonePath('curated');
    this.ensureDir(dir);
    fs.writeFileSync(path.join(dir, filename), JSON.stringify(content, null, 2), 'utf8');
  }

  public static readZoneFile(zone: 'raw' | 'normalized' | 'curated', filename: string): any | null {
    const filepath = path.join(this.getZonePath(zone), filename);
    if (!fs.existsSync(filepath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch {
      return null;
    }
  }

  public static clear(): void {
    if (fs.existsSync(this.baseDir)) {
      try {
        fs.rmSync(this.baseDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
