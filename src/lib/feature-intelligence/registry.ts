/**
 * EPIC 19.1 — Feature Registry
 * Centralized registry for all research features.
 */

import type { FeatureDescriptor, FeatureRegistrationInput, FeatureCategory } from './types';
import { generateFeatureId } from './id';

export class FeatureRegistry {
  private readonly features = new Map<string, FeatureDescriptor>();

  register(input: FeatureRegistrationInput): FeatureDescriptor {
    const descriptor: FeatureDescriptor = {
      featureId: input.featureId,
      version: input.version ?? '1.0.0',
      category: input.category,
      owner: input.owner,
      description: input.description,
      inputDependencies: input.inputDependencies ?? [],
      outputType: input.outputType,
      supportedMarkets: input.supportedMarkets ?? ['ML'],
      supportedCompetitions: input.supportedCompetitions ?? [],
      computationalCost: input.computationalCost ?? 'medium',
      refreshFrequency: input.refreshFrequency ?? 'daily',
      deterministic: input.deterministic ?? true,
      provenance: input.provenance ?? 'manual',
    };
    this.features.set(descriptor.featureId, descriptor);
    return descriptor;
  }

  get(featureId: string): FeatureDescriptor | undefined {
    return this.features.get(featureId);
  }

  getAll(): readonly FeatureDescriptor[] {
    return Array.from(this.features.values());
  }

  getByCategory(category: FeatureCategory): readonly FeatureDescriptor[] {
    return this.getAll().filter((f) => f.category === category);
  }

  ids(): readonly string[] {
    return Array.from(this.features.keys());
  }

  count(): number {
    return this.features.size;
  }
}

export const defaultFeatureRegistry = new FeatureRegistry();