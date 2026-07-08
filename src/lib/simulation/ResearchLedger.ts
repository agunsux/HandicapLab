import { Experiment } from './types';

export class ResearchLedger {
  private static store = new Map<string, Experiment>();

  /**
   * Immutably commits an experiment to the ledger.
   * If an experiment with the same ID already exists, it creates a new version.
   * (In production, this is an append-only DB table).
   */
  static commit(experiment: Experiment): string {
    let finalId = experiment.id;
    if (this.store.has(finalId)) {
      finalId = `${experiment.id}-v${Date.now()}`;
    }
    
    const archivedExp = { ...experiment, id: finalId };
    this.store.set(finalId, archivedExp);
    
    return finalId;
  }

  static get(experimentId: string): Experiment | undefined {
    return this.store.get(experimentId);
  }

  static _clear(): void {
    this.store.clear();
  }
}
