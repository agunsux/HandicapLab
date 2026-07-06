export class BootstrapCI {
  /**
   * Calculate 95% Confidence Interval for a given metric using non-parametric bootstrap.
   */
  public static calculate<T>(
    data: T[], 
    metricFn: (sample: T[]) => number, 
    iterations: number = 1000, 
    randomSeed?: number
  ): { lower: number, upper: number, mean: number } {
    if (data.length === 0) return { lower: 0, upper: 0, mean: 0 };
    
    // Seeded random number generator (simple LCG)
    let seed = randomSeed ?? Date.now();
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const results: number[] = [];
    const n = data.length;

    for (let i = 0; i < iterations; i++) {
      const sample: T[] = [];
      for (let j = 0; j < n; j++) {
        const index = Math.floor(random() * n);
        sample.push(data[index]);
      }
      results.push(metricFn(sample));
    }

    results.sort((a, b) => a - b);
    
    const lowerIndex = Math.floor(iterations * 0.025);
    const upperIndex = Math.floor(iterations * 0.975);
    const mean = results.reduce((sum, val) => sum + val, 0) / iterations;

    return {
      lower: results[lowerIndex],
      upper: results[upperIndex],
      mean
    };
  }
}
