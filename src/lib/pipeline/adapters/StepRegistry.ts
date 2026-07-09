/**
 * Step Registry — Plugin-friendly adapter registry
 * ==================================================
 * Adapters register themselves here. The engine resolves steps via this registry.
 * 
 * Engine → registry.get(stepId) → adapter.execute(contract, input)
 * 
 * Dependency direction: Engine → Registry → Adapter (never adapter → engine)
 */

import type { PipelineStepContract } from '@/lib/pipeline/contracts';
import type { ExecutionMode } from '@/lib/pipeline/engine';
import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AdapterManifest {
  /** Unique adapter identifier matching contract stepId */
  name: string;
  
  /** Semantic version of this adapter */
  version: string;
  
  /** Which contract this adapter implements */
  contractId: string;
  
  /** Team/owner responsible */
  owner: string;
  
  /** Other adapters this depends on */
  dependencies: string[];
  
  /** Adapter capabilities */
  capabilities: {
    idempotent: boolean;
    supportsReplay: boolean;
    supportsDryRun: boolean;
    supportsRollback: boolean;
  };
}

export interface AdapterOutput {
  success: boolean;
  output: Record<string, unknown>;
  durationMs: number;
  contractVersion: string;
  contractHash: string;
  warnings: string[];
  error?: string;
}

export interface ExecuteOptions {
  mode: ExecutionMode;
  dryRun?: boolean;
}

export interface IAdapter {
  readonly manifest: AdapterManifest;
  execute(
    contract: PipelineStepContract,
    input: Record<string, unknown>,
    options: ExecuteOptions
  ): Promise<AdapterOutput>;
}

// ─── Registry ───────────────────────────────────────────────────────────────

export class StepRegistry {
  private static adapters = new Map<string, IAdapter>();
  private static log = logger.child('step-registry');

  /**
   * Register an adapter.
   */
  static register(adapter: IAdapter): void {
    if (StepRegistry.adapters.has(adapter.manifest.name)) {
      StepRegistry.log.warn('adapter_re_registered', { 
        name: adapter.manifest.name,
        oldVersion: StepRegistry.adapters.get(adapter.manifest.name)?.manifest.version,
        newVersion: adapter.manifest.version,
      });
    }
    StepRegistry.adapters.set(adapter.manifest.name, adapter);
    StepRegistry.log.info('adapter_registered', {
      name: adapter.manifest.name,
      version: adapter.manifest.version,
      contract: adapter.manifest.contractId,
    });
  }

  /**
   * Get an adapter by step ID.
   */
  static get(stepId: string): IAdapter | undefined {
    return StepRegistry.adapters.get(stepId);
  }

  /**
   * Check if an adapter is registered.
   */
  static has(stepId: string): boolean {
    return StepRegistry.adapters.has(stepId);
  }

  /**
   * Get all registered adapters.
   */
  static getAll(): IAdapter[] {
    return Array.from(StepRegistry.adapters.values());
  }

  /**
   * Get adapter manifest for a step.
   */
  static getManifest(stepId: string): AdapterManifest | undefined {
    return StepRegistry.adapters.get(stepId)?.manifest;
  }

  /**
   * Generate coverage report.
   */
  static generateCoverageReport(): AdapterCoverageEntry[] {
    const report: AdapterCoverageEntry[] = [];
    
    for (const [stepId, adapter] of StepRegistry.adapters) {
      const manifest = adapter.manifest;
      report.push({
        adapter: manifest.name,
        version: manifest.version,
        contract: manifest.contractId,
        owner: manifest.owner,
        replay: manifest.capabilities.supportsReplay ? '✅' : '❌',
        dryRun: manifest.capabilities.supportsDryRun ? '✅' : '❌',
        idempotent: manifest.capabilities.idempotent ? '✅' : '❌',
        rollback: manifest.capabilities.supportsRollback ? '✅' : '❌',
      });
    }

    return report;
  }

  /**
   * Clear all adapters (for testing).
   */
  static clear(): void {
    StepRegistry.adapters.clear();
  }
}

export interface AdapterCoverageEntry {
  adapter: string;
  version: string;
  contract: string;
  owner: string;
  replay: string;
  dryRun: string;
  idempotent: string;
  rollback: string;
}

// ─── Base Adapter —──────────────────────────────────────────────────────────

export abstract class BaseAdapter implements IAdapter {
  abstract readonly manifest: AdapterManifest;

  abstract execute(
    contract: PipelineStepContract,
    input: Record<string, unknown>,
    options: ExecuteOptions
  ): Promise<AdapterOutput>;

  /**
   * Compute a hash of the contract for the adapter output.
   */
  protected computeContractHash(contract: PipelineStepContract): string {
    const relevant = `${contract.stepId}:${contract.input.requiredFields.join(',')}:${contract.output.guaranteedFields.join(',')}`;
    let hash = 0;
    for (let i = 0; i < relevant.length; i++) {
      const char = relevant.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `ch_${Math.abs(hash).toString(36)}`;
  }
}