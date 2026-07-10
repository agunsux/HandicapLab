import crypto from 'crypto';
import { PipelineStageResult, ExperimentResult } from './types';
import { CanonicalDataset } from '../dataset/types';
import { HistoricalDataProvider } from '../replay/providers';
import { ReplayRunner } from '../replay/ReplayRunner';
import { ProductionPredictorAdapter } from '../replay/ProductionPredictorAdapter';
import { computeMetrics } from '../validation/metrics';
import { computeCalibration } from '../validation/calibration';
import { ExperimentRegistry } from '../registry/experimentRegistry';
import { ModelRegistry, ModelMetrics } from '../registry/modelRegistry';

export class ExecutionPipeline {
  constructor(
    private readonly experimentRegistry: ExperimentRegistry,
    private readonly modelRegistry: ModelRegistry,
    private readonly dataProvider: HistoricalDataProvider,
  ) {}
  async run(options: {
    experimentId: string; dataset: CanonicalDataset; modelId: string;
    maxMatches?: number; replaySeed?: number;
  }): Promise<ExperimentResult> {
    const stages: PipelineStageResult[] = [];
    const startTime = Date.now();
    const exp = this.experimentRegistry.get(options.experimentId);
    if (!exp) throw new Error('Experiment '+options.experimentId+' not found');
    const model = this.modelRegistry.get(options.modelId);
    if (!model) throw new Error('Model '+options.modelId+' not found');
    this.experimentRegistry.start(options.experimentId);
    stages.push({stage:'experiment_started',status:'success',durationMs:Date.now()-startTime});
    const replayStart = Date.now();
    const predictor = new ProductionPredictorAdapter();
    const runner = new ReplayRunner(this.dataProvider,predictor,{maxMatches:options.maxMatches||1000});
    const replayResult = await runner.run();
    stages.push({stage:'replay',status:'success',durationMs:Date.now()-replayStart});
    const valStart = Date.now();
    const validationInput = {
      predictedProbabilities: replayResult.outcomes.map(o=>o.predictedProbability),
      actualOutcomes: replayResult.outcomes.map(o=>o.actualResult),
      marketOdds: replayResult.outcomes.map(()=>2.0),
      stakes: replayResult.outcomes.map(()=>0.1),
    };
    const validationMetrics = computeMetrics(validationInput);
    const calibration = replayResult.outcomes.length>0
      ? computeCalibration(
          replayResult.outcomes.map(o=>o.predictedProbability),
          replayResult.outcomes.map(o=>o.actualResult))
      : {bins:[],ece:0,mce:0,sharpness:0,confidenceHistogram:[]};
    stages.push({stage:'validation',status:'success',durationMs:Date.now()-valStart});
    this.modelRegistry.setValidationMetrics(options.modelId,{
      roi:validationMetrics.roi,brierScore:validationMetrics.brierScore,
      logLoss:validationMetrics.logLoss,ece:calibration.ece,
      avgClv:validationMetrics.avgClv,sharpeRatio:validationMetrics.sharpeRatio,
      winRate:validationMetrics.winRate,totalBets:validationMetrics.totalBets},
      {ece:calibration.ece,mce:calibration.mce,sharpness:calibration.sharpness});
    this.experimentRegistry.complete(options.experimentId,{
      roi:validationMetrics.roi,yield_:validationMetrics.yield_,
      brierScore:validationMetrics.brierScore,logLoss:validationMetrics.logLoss,
      ece:calibration.ece,avgClv:validationMetrics.avgClv,
      sharpeRatio:validationMetrics.sharpeRatio,winRate:validationMetrics.winRate});
    const durationMs = Date.now()-startTime;
    const artifacts = {experimentId:options.experimentId,
      config:{modelId:options.modelId,datasetHash:options.dataset.manifest.hash,replaySeed:options.replaySeed},
      validation:validationMetrics as unknown as Record<string,unknown>, benchmark:{},
      report:'# Execution Report\\n\\nROI: '+validationMetrics.roi+'%\\nBrier: '+validationMetrics.brierScore+'\\nCalibration ECE: '+calibration.ece,
      summary:{roi:validationMetrics.roi,brier:validationMetrics.brierScore,ece:calibration.ece},
      logs:stages.map(s=>'['+s.status+'] '+s.stage+': '+s.durationMs+'ms'),
      createdAt:new Date().toISOString()};
    return {experiment:exp,
      dataset:{hash:options.dataset.manifest.hash,version:options.dataset.manifest.version},
      model:{id:model.id,name:model.name,version:model.semanticVersion},
      replay:replayResult.metrics,validation:validationMetrics,calibration:calibration,
      benchmark:[],artifacts,
      metadata:{executionId:crypto.randomUUID(),correlationId:crypto.randomUUID(),
        configurationHash:String(options.replaySeed||42),datasetHash:options.dataset.manifest.hash,
        engineVersion:'1.0.0',replaySeed:options.replaySeed||42,
        startedAt:new Date(startTime).toISOString(),finishedAt:new Date().toISOString(),
        durationMs,status:'completed'},
      durationMs,completedAt:new Date().toISOString()};}}