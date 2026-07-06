// HandicapLab Decision Engine v1 - Experiment Registry
// Location: src/lib/engines/decision-engine-v1/experiment-registry.ts

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface ExperimentRunRecord {
  modelName: string;
  weights: Record<string, number>;
  roi: number;
  yield: number;
  logLoss: number;
  brier: number;
  avgCLV: number;
  timestamp: string;
  commitSha: string;
}

export class ExperimentRegistry {
  private static registryPath = path.join(
    'C:', 'Users', 'RYZEN', '.gemini', 'antigravity-ide', 'brain', 
    'b0e51ad4-db7e-4196-9e0e-e58ff37caeeb', 'artifacts', 'experiment_runs.json'
  );

  /**
   * Retrieves the current Git commit SHA.
   */
  private static getCommitSHA(): string {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (e) {
      return 'unknown-sha';
    }
  }

  /**
   * Automatically logs the details of an experiment run.
   */
  public static logRun(record: Omit<ExperimentRunRecord, 'timestamp' | 'commitSha'>): void {
    const timestamp = new Date().toISOString();
    const commitSha = this.getCommitSHA();
    const fullRecord: ExperimentRunRecord = { ...record, timestamp, commitSha };

    let runs: ExperimentRunRecord[] = [];
    try {
      if (fs.existsSync(this.registryPath)) {
        const fileContent = fs.readFileSync(this.registryPath, 'utf-8');
        runs = JSON.parse(fileContent);
      }
    } catch (e) {
      // Gracefully continue with an empty list
    }

    runs.push(fullRecord);

    try {
      const dir = path.dirname(this.registryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.registryPath, JSON.stringify(runs, null, 2));
    } catch (e) {
      console.error('Failed to write to experiment run registry:', e);
    }
  }
}
