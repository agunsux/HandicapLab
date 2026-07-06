// HandicapLab Data Platform - Scientific Benchmark Runner
import { PredictionModel } from '../engines/decision-engine-v1/models/predictionModel';
import { ValidationStrategy, ValidationFold } from './validationStrategy';
import { Metrics } from './metrics';
import { CalibrationEngine } from './calibration';
import { BootstrapCI } from './bootstrap';
import { BettingPerformance } from './bettingPerformance';
import { CLVCalculator, CLVRecord } from './clvCalculator';
import { DriftDetector } from './driftDetector';
import { FeatureImportance } from './featureImportance';
import { ExperimentRegistry, ExperimentRecord } from './experimentRegistry';
import { ModelCardGenerator } from './modelCardGenerator';
import { DashboardGenerator } from './dashboardGenerator';
import * as path from 'path';

export interface BenchmarkConfig {
  datasetPath: string; // Parquet or memory dataset
  features: string[];
  deterministic: boolean;
  randomSeed: number;
  strategy: 'rolling' | 'expanding';
  windowSize: number;
}

export class BenchmarkRunner {
  private config: BenchmarkConfig;

  constructor(config: BenchmarkConfig) {
    this.config = config;
  }

  /**
   * Run the full scientific benchmark for a single model
   */
  public async evaluateModel(model: PredictionModel, dataset: any[]): Promise<string> {
    const startTime = Date.now();
    
    // In deterministic mode, we freeze PRNG internally if needed
    if (this.config.deterministic) {
      // Set global seeds for third-party libraries if they exist
    }

    // Example seasons extraction
    const seasons = ['2018', '2019', '2020', '2021', '2022', '2023'];
    let folds: ValidationFold[] = [];
    
    if (this.config.strategy === 'rolling') {
      folds = ValidationStrategy.rollingWindow(seasons, this.config.windowSize);
    } else {
      folds = ValidationStrategy.expandingWindow(seasons, this.config.windowSize);
    }

    const allPredictions: any[] = [];
    const allOutcomes: number[] = [];
    const clvRecords: CLVRecord[] = [];
    const bettingRecords: any[] = [];

    // Evaluate over folds
    for (const fold of folds) {
      // Normally we would filter `dataset` using `fold.trainWindow` and `fold.testWindow`
      const trainSet = dataset.filter(d => true); // Placeholder
      const testSet = dataset.filter(d => true); // Placeholder

      // State restoration for determinism
      if (model.metadata().isOnline) {
         // Snapshot restore if needed
         if ((model as any).restore) {
             (model as any).restore({}); // Empty state
         }
      }

      await model.train(trainSet);

      for (const match of testSet) {
        const pred = await model.predict(match);
        const outcome = match.fullTimeHomeGoals > match.fullTimeAwayGoals ? 1 : 0;
        
        allPredictions.push({ probability: pred.pHome, outcome });
        allOutcomes.push(outcome);

        const bookmakerOdds = match.closingOddsHome || 2.0;

        bettingRecords.push({
          probability: pred.pHome,
          impliedOdds: 1 / pred.pHome,
          bookmakerOdds,
          outcome
        });

        if (match.openingOddsHome && match.closingOddsHome) {
            clvRecords.push({
                openingOdds: match.openingOddsHome,
                closingOdds: match.closingOddsHome,
                betTime: new Date().toISOString(),
                closingEdge: pred.pHome * match.closingOddsHome - 1,
                clv: CLVCalculator.calculateCLV(match.openingOddsHome, match.closingOddsHome),
                positiveCLV: match.openingOddsHome > match.closingOddsHome
            });
        }
      }
    }

    // 1. Calculate Metrics & CIs
    const brierCI = BootstrapCI.calculate(allPredictions, Metrics.brierScore, 1000, this.config.randomSeed);
    const logLossCI = BootstrapCI.calculate(allPredictions, Metrics.logLoss, 1000, this.config.randomSeed);
    const rocCI = BootstrapCI.calculate(allPredictions, Metrics.rocAuc, 1000, this.config.randomSeed);
    const prCI = BootstrapCI.calculate(allPredictions, Metrics.prAuc, 1000, this.config.randomSeed);

    const ece = CalibrationEngine.calculateECE(allPredictions);
    const mce = CalibrationEngine.calculateMCE(allPredictions);

    // 2. Betting Performance (Kelly Simulation)
    const bettingPerformance = BettingPerformance.simulate(bettingRecords, 'half_kelly');

    // 3. CLV Aggregation
    const clvAgg = CLVCalculator.aggregate(clvRecords);

    // 4. Feature Importance (Permutation)
    const importance = await FeatureImportance.permutationImportance(
        model, 
        dataset, 
        this.config.features, 
        Metrics.brierScore, 
        false, 
        this.config.randomSeed
    );

    // 5. Concept Drift Detection (Compare first half of test to second half)
    const mid = Math.floor(allPredictions.length / 2);
    const firstHalfProbs = allPredictions.slice(0, mid).map(p => p.probability);
    const secondHalfProbs = allPredictions.slice(mid).map(p => p.probability);
    const drift = DriftDetector.detectDrift(firstHalfProbs, secondHalfProbs);

    // Prepare Artifacts
    const executionTimeMs = Date.now() - startTime;

    const experimentRecord: ExperimentRecord = {
      timestamp: new Date().toISOString(),
      gitCommit: 'latest', // Normally git rev-parse HEAD
      datasetHash: 'hash',
      datasetVersion: 'v1.0',
      featureVersion: 'v1.0',
      modelVersion: model.metadata().version,
      calibrationVersion: 'v1.0',
      randomSeed: this.config.randomSeed,
      trainingWindow: { start: '2018', end: '2023' },
      testingWindow: { start: '2018', end: '2023' },
      hyperparameters: { deterministic: this.config.deterministic },
      executionTimeMs,
      machineInfo: { cpu: 'unknown', ram: 'unknown', os: 'windows' }
    };

    const metricsPayload = {
      brierScore: brierCI,
      logLoss: logLossCI,
      rocAuc: rocCI,
      prAuc: prCI,
      ece,
      mce,
      betting: bettingPerformance,
      clv: clvAgg,
      drift
    };

    const reliabilityData = CalibrationEngine.generateReliabilityCurve(allPredictions);

    // We'd normally use parquet, just mock buffers for the prototype
    const mockParquetBuf = Buffer.from('PAR1'); 
    
    // Log to Registry
    const expId = ExperimentRegistry.logExperiment(
      experimentRecord,
      metricsPayload,
      mockParquetBuf,
      reliabilityData,
      mockParquetBuf,
      importance
    );

    // Generate Dashboard
    const expDir = path.join(process.cwd(), 'research', 'experiments', expId);
    DashboardGenerator.generateDashboard(
      bettingPerformance.bankrollHistory,
      reliabilityData,
      importance,
      path.join(expDir, 'dashboard.html')
    );

    // Generate Model Card
    ModelCardGenerator.export({
      modelName: model.metadata().name,
      version: model.metadata().version,
      description: model.metadata().description,
      architecture: 'Unknown',
      hyperparameters: experimentRecord.hyperparameters,
      dataset: {
        name: 'Gold Dataset v1.0',
        description: 'EPL Historical',
        trainingWindow: '2018-2023',
        testingWindow: '2018-2023',
        featureSet: this.config.features
      },
      performance: {
        logLoss: logLossCI.mean,
        brierScore: brierCI.mean,
        rocAuc: rocCI.mean,
        prAuc: prCI.mean,
        ece,
        mce
      },
      businessImpact: {
        flatROI: 0, // Placeholder
        kellyROI: bettingPerformance.roi,
        maxDrawdown: bettingPerformance.maxDrawdown,
        clvAverage: clvAgg.averageCLV,
        positiveCLVPercent: clvAgg.positiveCLVPercent
      },
      limitations: ['Static configuration'],
      ethicalConsiderations: ['Do not use for real money betting without human oversight'],
      creationDate: new Date().toISOString()
    }, path.join(expDir, 'model_card.md'));

    return expId;
  }
}
