import { ExplanationObject, ExplanationRegistryEntry } from './types';

export class ExplanationRegistry {
  // In-memory storage for scaffolding. Will be replaced by DB queries.
  private static store = new Map<string, ExplanationRegistryEntry>();

  /**
   * Persists the explanation to storage.
   */
  static save(explanation: ExplanationObject): void {
    const entry: ExplanationRegistryEntry = {
      decisionId: explanation.decisionId,
      explanationVersion: explanation.explanationVersion,
      explanation,
      generatedAt: explanation.generatedAt
    };
    
    this.store.set(explanation.decisionId, entry);
  }

  /**
   * Retrieves an explanation by decision ID.
   */
  static get(decisionId: string): ExplanationObject | null {
    const entry = this.store.get(decisionId);
    return entry ? entry.explanation : null;
  }

  /**
   * For testing: clear the registry.
   */
  static _clear(): void {
    this.store.clear();
  }
}
