// HandicapLab Data Platform - Experiment Registry
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ExperimentRecord {
  timestamp: string; // ISO
  gitCommit: string;
  datasetHash: string;
  datasetVersion: string;
  featureVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  randomSeed: number;
  trainingWindow: { start: string; end: string };
  testingWindow: { start: string; end: string };
  hyperparameters: Record<string, any>;
  executionTimeMs: number;
  machineInfo: { cpu: string; ram: string; os: string };
}

export class ExperimentRegistry {
  private static getResearchDir(): string {
    return path.join(process.cwd(), 'research');
  }

  private static getExperimentsDir(): string {
    return path.join(this.getResearchDir(), 'experiments');
  }

  private static getRegistryFile(): string {
    return path.join(this.getResearchDir(), 'registry.json');
  }

  private static generateHash(record: ExperimentRecord): string {
    const dataStr = JSON.stringify({
      gitCommit: record.gitCommit,
      datasetHash: record.datasetHash,
      modelVersion: record.modelVersion,
      randomSeed: record.randomSeed,
      trainingWindow: record.trainingWindow,
      testingWindow: record.testingWindow,
      hyperparameters: record.hyperparameters
    });
    return crypto.createHash('sha256').update(dataStr).digest('hex').substring(0, 16);
  }

  private static generateExperimentId(): string {
    const registryFile = this.getRegistryFile();
    let nextIdNum = 1;
    if (fs.existsSync(registryFile)) {
      const registry = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
      if (registry.length > 0) {
        const lastIdStr = registry[registry.length - 1].experimentId;
        const match = lastIdStr.match(/EXP(\d+)/);
        if (match) {
          nextIdNum = parseInt(match[1], 10) + 1;
        }
      }
    }
    return `EXP${String(nextIdNum).padStart(6, '0')}`;
  }

  /**
   * Logs a new experiment. Creates immutable directory and records.
   */
  public static logExperiment(
    record: ExperimentRecord,
    metrics: any,
    predictionsParquetBuf: Buffer,
    calibrationData: any,
    bankrollParquetBuf: Buffer,
    featureImportance: any
  ): string {
    const researchDir = this.getResearchDir();
    const expDirRoot = this.getExperimentsDir();
    
    if (!fs.existsSync(researchDir)) fs.mkdirSync(researchDir, { recursive: true });
    if (!fs.existsSync(expDirRoot)) fs.mkdirSync(expDirRoot, { recursive: true });

    const expId = this.generateExperimentId();
    const expDir = path.join(expDirRoot, expId);
    
    if (fs.existsSync(expDir)) {
      throw new Error(`Experiment directory ${expDir} already exists. Immutable violation.`);
    }
    fs.mkdirSync(expDir, { recursive: true });

    const registryFile = this.getRegistryFile();
    let registry = [];
    if (fs.existsSync(registryFile)) {
      registry = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
    }

    const hash = this.generateHash(record);
    const summary = {
      experimentId: expId,
      timestamp: record.timestamp,
      model: record.modelVersion,
      datasetHash: record.datasetHash,
      hash
    };
    registry.push(summary);
    fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2));

    // Write immutable files
    fs.writeFileSync(path.join(expDir, 'metadata.json'), JSON.stringify(record, null, 2));
    fs.writeFileSync(path.join(expDir, 'config.json'), JSON.stringify({ 
      hyperparameters: record.hyperparameters,
      trainingWindow: record.trainingWindow,
      testingWindow: record.testingWindow,
      randomSeed: record.randomSeed
    }, null, 2));
    fs.writeFileSync(path.join(expDir, 'metrics.json'), JSON.stringify(metrics, null, 2));
    fs.writeFileSync(path.join(expDir, 'calibration.json'), JSON.stringify(calibrationData, null, 2));
    fs.writeFileSync(path.join(expDir, 'feature_importance.json'), JSON.stringify(featureImportance, null, 2));
    
    // Write parquet buffers
    fs.writeFileSync(path.join(expDir, 'predictions.parquet'), predictionsParquetBuf);
    fs.writeFileSync(path.join(expDir, 'bankroll.parquet'), bankrollParquetBuf);

    return expId;
  }
}
