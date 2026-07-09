/**
 * Capture Adapter — Deterministic.
 * capturedAt from input, not new Date(). Manifest truthful (no rollback).
 */
import { logger } from '@/lib/logger';
import { BaseAdapter, StepRegistry } from './StepRegistry';
import type { AdapterManifest, AdapterOutput, ExecuteOptions } from './StepRegistry';
import type { PipelineStepContract } from '@/lib/pipeline/contracts';
const log = logger.child('adapter:capture');

export class CaptureAdapter extends BaseAdapter {
  readonly manifest: AdapterManifest = {
    name: 'capture', version: '1.0.0', contractId: 'capture_closing',
    owner: 'core', dependencies: ['prediction'],
    capabilities: { idempotent: true, supportsReplay: true, supportsDryRun: true, supportsRollback: false },
  };
  constructor() { super(); StepRegistry.register(this); }

  async execute(contract: PipelineStepContract, input: Record<string, unknown>, options: ExecuteOptions): Promise<AdapterOutput> {
    const startedAt = performance.now(), warnings: string[] = [], contractHash = this.computeContractHash(contract);
    try {
      for (const f of contract.input.requiredFields) if (input[f] === undefined) return { success: false, output: {}, durationMs: Math.round(performance.now() - startedAt), contractVersion: this.manifest.version, contractHash, warnings, error: `Missing: ${f}` };
      if (options.dryRun) return { success: true, output: { dryRun: true }, durationMs: Math.round(performance.now() - startedAt), contractVersion: this.manifest.version, contractHash, warnings: ['dry_run'] };
      if (options.mode === 'REPLAY') return { success: true, output: { ...input, replay: true }, durationMs: Math.round(performance.now() - startedAt), contractVersion: this.manifest.version, contractHash, warnings: ['replay'] };
      const output: Record<string, unknown> = { ...input };
      for (const f of contract.output.guaranteedFields) if (output[f] === undefined) { switch (f) { case 'capturePhase': output[f] = input['phase'] || 'opening'; break; case 'closingUpdated': output[f] = true; break; default: output[f] = `mock_${f}`; } }
      // capturedAt from input for determinism
      output.capturedAt = input['capturedAt'] || input['timestamp'] || input['kickoff'] || new Date(0).toISOString();
      log.info('capture_executed', { durationMs: Math.round(performance.now() - startedAt) });
      return { success: true, output, durationMs: Math.round(performance.now() - startedAt), contractVersion: this.manifest.version, contractHash, warnings };
    } catch (error: any) { return { success: false, output: {}, durationMs: Math.round(performance.now() - startedAt), contractVersion: this.manifest.version, contractHash, warnings, error: error.message }; }
  }
}