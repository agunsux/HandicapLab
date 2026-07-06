// HandicapLab Live Data Platform - Feature Store Foundation
// Location: src/lib/data-platform/featureStore.ts

import fs from 'fs';
import path from 'path';

export interface FeatureMetadata {
  featureName: string;
  version: string;
  source: string;
  createdAt: string;
  checksum: string;
  schema: any;
  owner: string;
}

export class FeatureStore {
  private static localStore = 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\b0e51ad4-db7e-4196-9e0e-e58ff37caeeb\\artifacts\\data-platform\\features.json';

  private static load(): FeatureMetadata[] {
    if (fs.existsSync(this.localStore)) {
      try {
        return JSON.parse(fs.readFileSync(this.localStore, 'utf8'));
      } catch {
        return [];
      }
    }
    return [];
  }

  private static save(data: FeatureMetadata[]): void {
    const dir = path.dirname(this.localStore);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.localStore, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Registers a versioned feature to the store.
   */
  public static registerFeature(metadata: FeatureMetadata): void {
    const data = this.load();
    // Prevent duplicates
    const filtered = data.filter((f) => !(f.featureName === metadata.featureName && f.version === metadata.version));
    filtered.push(metadata);
    this.save(filtered);
  }

  /**
   * Gets all versioned features.
   */
  public static getFeatures(): FeatureMetadata[] {
    return this.load();
  }

  /**
   * Reset store (primarily for tests).
   */
  public static clear(): void {
    if (fs.existsSync(this.localStore)) {
      try {
        fs.unlinkSync(this.localStore);
      } catch {}
    }
  }
}
