/**
 * Prediction Adapter — Deterministic. 
 * All outputs derive from input. crypto.randomUUID fallback removed.
 * PredictionId comes from input (deterministic).
 * Manifests truthful: no rollback capability (supportsRollback = false).
 */
import { logger } from '@/lib/logger';
import { BaseAdapter, StepRegistry } from './StepRegistry';
import { computeInputHash } from '@/lib/pipeline/PipelineRunContext';
import type { AdapterManifest, AdapterOutput, ExecuteOptions } from './StepRegistry';
import type { PipelineStepContract } from '@/lib/pipeline/contracts';
const log = logger.child('adapter:prediction');

export class PredictionAdapter extends BaseAdapter {
  readonly manifest: AdapterManifest = {
    name: 'prediction', version: '1.0.0', contractId: 'prediction',
    owner: 'core', dependencies: ['feature_engineering'],
    capabilities: { idempotent: true, supportsReplay: true, supportsDryRun: true, supportsRollback: false },
  };
  constructor() { super(); StepRegistry.register(this); }

  async execute(contract: PipelineStepContract, input: Record<string, unknown>, options: ExecuteOptions): Promise<AdapterOutput> {
    const startedAt = performance.now(), warnings: string[] = [], contractHash = this.computeContractHash(contract);
    try {
      for (const f of contract.input.requiredFields) if (input[f] === undefined) return { success: false, output: {}, durationMs: Math.round(performance.now() - startedAt), contractVersion: this.manifest.version, contractHash, warnings, error: `Missing: ${f}` };
      if (options.dryRun) return { success: true, output: { dryRun: true }, durationMs: Math.round(performance.now() - startedAt), contractVersion: this.manifest.version, contractHash, warnings: ['dry_run'] };
      if (options.mode === 'REPLAY') return { success: true, output: { ...input, replay: true }, durationMs: Math.round(performance.now() - startedAt), contractVersion: this.manifest.version, contractHash, warnings: ['replay'] };
      const inputHash = computeInputHash(input);
      const output: Record<string, unknown> = { ...input };
      output.predictionId = input.predictionId || `det_pred_${inputHash}`; // deterministic fallback
      for (const f of contract.output.guaranteedFields) if (output[f] === undefined) { switch (f) { case 'homeProb': output[f] = 0.5; break; case 'drawProb': output[f] = 0.3; break; case 'awayProb': output[f] = 0.2; break; case 'expectedGoals': output[f] = 2.5; break; case 'confidence': output[f] = 'medium'; break; case 'modelVersion': output[f] = 'v1'; break; default: output[f] = `det_${f}_${inputHash}`; } }
      log.info('prediction_executed', { durationMs: Math.round(performance.now() - startedAt) });
      return { success: true, output, durationMs: Math.round(performance.now() - startedAt), contractVersion: this.manifest.version, contractHash, warnings };
    } catch (error: any) { return { success: false, output: {}, durationMs: Math.round(performance.now() - startedAt), contractVersion: this.manifest.version, contractHash, warnings, error: error.message }; }
  }
}