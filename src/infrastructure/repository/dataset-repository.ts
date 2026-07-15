import fs from 'fs';
import path from 'path';
import { DatasetRepository, DatasetManifest } from '../../domain/dataset/repository';

export class FileDatasetRepository implements DatasetRepository {
  private dirPath: string;

  constructor(projectRoot?: string) {
    const root = projectRoot || process.cwd();
    this.dirPath = path.join(root, 'data', 'silver');
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath, { recursive: true });
    }
  }

  private getManifestPath(version: number): string {
    return path.join(this.dirPath, `manifest_v${version}.json`);
  }

  public async saveManifest(manifest: DatasetManifest): Promise<void> {
    const filePath = this.getManifestPath(manifest.datasetVersion);
    fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf-8');
    
    // Save as current manifest pointer
    const currentPath = path.join(this.dirPath, 'manifest.json');
    fs.writeFileSync(currentPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  public async getManifest(version: number): Promise<DatasetManifest | null> {
    const filePath = this.getManifestPath(version);
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  public async getCurrentVersion(): Promise<number> {
    const currentPath = path.join(this.dirPath, 'manifest.json');
    if (!fs.existsSync(currentPath)) return 0;
    try {
      const manifest: DatasetManifest = JSON.parse(fs.readFileSync(currentPath, 'utf-8'));
      return manifest.datasetVersion;
    } catch {
      return 0;
    }
  }

  public async freezeVersion(version: number, manifest: DatasetManifest): Promise<void> {
    const frozenManifest = {
      ...manifest,
      state: 'FROZEN' as const
    };
    await this.saveManifest(frozenManifest);
  }
}
