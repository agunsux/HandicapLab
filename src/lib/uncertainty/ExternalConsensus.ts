export interface ExternalSourceScore {
  sourceName: string; // e.g. Community, Government, Bank, OSINT
  score: number;      // e.g. 0 to 100
  weight: number;     // e.g. 0 to 1
}

export class ExternalConsensus {
  /**
   * Evaluates consensus across external sources.
   * If all sources align with high scores, consensus is high.
   * 
   * @param sources Array of external scores
   * @returns A consensus score between 0 and 1.
   */
  static evaluate(sources: ExternalSourceScore[]): number {
    if (sources.length === 0) return 0.5; // Neutral if no external data

    let totalWeight = 0;
    let weightedSum = 0;

    for (const source of sources) {
      // Normalize score to 0-1
      const normalizedScore = Math.max(0, Math.min(1, source.score / 100));
      weightedSum += normalizedScore * source.weight;
      totalWeight += source.weight;
    }

    if (totalWeight === 0) return 0.5;

    // Consensus score is the weighted average. 
    // In a more advanced implementation, high variance between sources might lower this score.
    return weightedSum / totalWeight;
  }
}
