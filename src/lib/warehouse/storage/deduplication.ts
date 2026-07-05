export type DeduplicationStrategy = 'KEEP_FIRST' | 'KEEP_LAST' | 'MERGE';

export class DeduplicationEngine {
  /**
   * Deduplicates a list of objects based on a key extraction function and strategy.
   */
  public static deduplicate<T>(
    items: T[],
    keyExtractor: (item: T) => string,
    strategy: DeduplicationStrategy = 'KEEP_FIRST'
  ): { deduplicated: T[]; duplicateCount: number } {
    const seen = new Map<string, T>();
    let duplicateCount = 0;

    for (const item of items) {
      const key = keyExtractor(item);

      if (seen.has(key)) {
        duplicateCount++;
        if (strategy === 'KEEP_LAST') {
          seen.set(key, item);
        } else if (strategy === 'MERGE') {
          const existing = seen.get(key)!;
          seen.set(key, { ...existing, ...item });
        }
        // KEEP_FIRST ignores subsequent items, keeping the first encountered
      } else {
        seen.set(key, item);
      }
    }

    return {
      deduplicated: Array.from(seen.values()),
      duplicateCount
    };
  }
}
