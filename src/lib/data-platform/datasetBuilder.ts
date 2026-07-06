// HandicapLab Live Data Platform - Dataset Builder
// Location: src/lib/data-platform/datasetBuilder.ts

import { CanonicalOdds } from './canonicalModel';
import { DataQualityEngine, DataQualityReport } from './dataQualityEngine';
import { FeatureStore } from './featureStore';
import fs from 'fs';
import path from 'path';

export interface DatasetManifest {
  datasetId: string;
  version: string;
  recordCount: number;
  qualityReport: DataQualityReport;
  featuresVersion: string;
  exportedAt: string;
}

export class DatasetBuilder {
  private static manifestsPath = 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\b0e51ad4-db7e-4196-9e0e-e58ff37caeeb\\artifacts\\data-platform\\datasets.json';

  private static loadManifests(): DatasetManifest[] {
    if (fs.existsSync(this.manifestsPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.manifestsPath, 'utf8'));
      } catch {
        return [];
      }
    }
    return [];
  }

  private static saveManifests(data: DatasetManifest[]): void {
    const dir = path.dirname(this.manifestsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.manifestsPath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Builds, validates, and registers a versioned research dataset.
   */
  public static build(
    records: CanonicalOdds[],
    datasetVersion: string,
    featuresVersion: string
  ): DatasetManifest {
    const qualityReport = DataQualityEngine.evaluate(records);
    const datasetId = `ds-${datasetVersion}`;
    const exportedAt = new Date().toISOString();

    const manifest: DatasetManifest = {
      datasetId,
      version: datasetVersion,
      recordCount: records.length,
      qualityReport,
      featuresVersion,
      exportedAt
    };

    const manifests = this.loadManifests();
    const filtered = manifests.filter((m) => m.version !== datasetVersion);
    filtered.push(manifest);
    this.saveManifests(filtered);

    return manifest;
  }

  public static getDatasets(): DatasetManifest[] {
    return this.loadManifests();
  }

  public static clear(): void {
    if (fs.existsSync(this.manifestsPath)) {
      try {
        fs.unlinkSync(this.manifestsPath);
      } catch {}
    }
  }
}
