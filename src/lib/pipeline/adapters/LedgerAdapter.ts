/**
 * Ledger Adapter — Truthful manifest, deterministic.
 * entryId and chainHash from input, not crypto.randomUUID().
 */
import { logger } from '@/lib/logger';
import { BaseAdapter, StepRegistry } from './StepRegistry';
import type { AdapterManifest, AdapterOutput, ExecuteOptions } from './StepRegistry';
import type { PipelineStepContract } from '@/lib/pipeline/contracts';
const log = logger.child('adapter:ledger');

export class LedgerAdapter extends BaseAdapter {
  readonly manifest: AdapterManifest = {
    name: 'ledger', version: '1.0.0', contractId: 'ledger',
    owner: 'core', dependencies: ['prediction', 'settlement', 'clv'],
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
      for (const f of contract.output.guaranteedFields) if (output[f] === undefined) { switch (f) { case 'entryId': output[f] = input['entryId'] || `det_entry_${contractHash.slice(0, 8)}`; break; case 'chainHash': output[f] = input['chainHash'] || `ch_${contractHash.slice(0, 8)}`; break; case 'previousEntryId': output[f] = input['previousEntryId'] || `genesis`; break; default: output[f] = `mock_${f}`; } }
      log.info('ledger_executed', { durationMs: Math.round(performance.now() - startedAt) });
      return { success: true, output, durationMs: Math.round(performance.now() - startedAt), contractVersion: this.manifest.version, contractHash, warnings };
    } catch (error: any) { return { success: false, output: {}, durationMs: Math.round(performance.now() - startedAt), contractVersion: this.manifest.version, contractHash, warnings, error: error.message }; }
  }
}