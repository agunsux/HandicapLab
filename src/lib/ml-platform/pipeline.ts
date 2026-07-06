// HandicapLab ML Platform - Deterministic Training Pipeline
import { MachineLearningModel, ModelMetadata } from './interface';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface TrainingConfig {
  datasetVersion: string;
  featureVersion: string;
  registryVersion: string;
  calibrationVersion: string;
  benchmarkVersion: string;
  randomSeed: number;
  gitCommit: string;
  hyperparameters: Record<string, any>;
}

export class TrainingPipeline {
  /**
   * Executes the strict deterministic sequence for training an ML model.
   */
  public static async execute(model: MachineLearningModel, config: TrainingConfig, data: any[]): Promise<void> {
    const startTime = Date.now();

    // 1. Verify Dataset Version Contract
    this.verifyContract(config);

    // 2. Snapshot -> Split -> Scale (Mocked Data Pipeline)
    const trainSet = data.slice(0, Math.floor(data.length * 0.8));
    const valSet = data.slice(Math.floor(data.length * 0.8));

    // 3. Train
    await model.train(trainSet.map(d => d.features), trainSet.map(d => d.target));

    // 4. Calibrate
    await model.calibrate(valSet.map(d => d.features), valSet.map(d => d.target));

    // 5. Generate Fingerprint
    const fingerprint = this.generateFingerprint(config, model);

    // 6. Generate Manifest
    const endTime = Date.now();
    const manifest = {
      modelId: model.metadata().modelId,
      version: model.metadata().version,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      trainingDurationMs: endTime - startTime,
      dataset: config.datasetVersion,
      features: config.featureVersion,
      hyperparameters: config.hyperparameters,
      fingerprint
    };

    // 7. Save Artifacts
    const artifactDir = path.join(process.cwd(), 'models', model.metadata().algorithm, model.metadata().version);
    if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
    
    fs.writeFileSync(path.join(artifactDir, 'training_manifest.json'), JSON.stringify(manifest, null, 2));
    await model.save(artifactDir);
  }

  private static verifyContract(config: TrainingConfig) {
    const required = ['datasetVersion', 'featureVersion', 'registryVersion', 'calibrationVersion', 'benchmarkVersion', 'randomSeed', 'gitCommit'];
    for (const req of required) {
      if (!(config as any)[req]) {
        throw new Error(`Missing Dataset Version Contract field: ${req}`);
      }
    }
  }

  private static generateFingerprint(config: TrainingConfig, model: MachineLearningModel): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(config));
    hash.update(model.metadata().algorithm);
    return hash.digest('hex');
  }
}
