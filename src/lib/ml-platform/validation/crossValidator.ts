import { MachineLearningModel } from '../interface';

export type CVMode = 'expanding' | 'rolling' | 'sliding' | 'season';

export interface Split {
  trainIndices: number[];
  testIndices: number[];
}

export interface CrossValidationResult {
  foldResults: FoldResult[];
  overallMetrics: {
    meanROI: number;
    stdROI: number;
    meanLogLoss: number;
    stdLogLoss: number;
    meanBrier: number;
    stdBrier: number;
  };
}

export interface FoldResult {
  foldNumber: number;
  trainSize: number;
  testSize: number;
  metrics: {
    roi: number;
    logLoss: number;
    brier: number;
    accuracy: number;
  };
}

/**
 * CrossValidator
 * Implements walk-forward cross-validation strategies.
 * Agnostic to the underlying model, requires a model factory or an instance that can be cloned/retrained.
 */
export class CrossValidator {
  constructor(private mode: CVMode, private windowSize?: number) {}

  /**
   * Generates fold indices based on the dataset length and mode.
   * Assumes data is already sorted by time.
   */
  generateSplits(datasetSize: number, dates?: Date[]): Split[] {
    const splits: Split[] = [];
    
    if (this.mode === 'season' && dates) {
      // Season split logic
      const years = Array.from(new Set(dates.map(d => d.getFullYear()))).sort();
      for (let i = 0; i < years.length - 1; i++) {
        const train = dates.reduce((acc, d, idx) => {
          if (d.getFullYear() <= years[i]) acc.push(idx);
          return acc;
        }, [] as number[]);
        const test = dates.reduce((acc, d, idx) => {
          if (d.getFullYear() === years[i + 1]) acc.push(idx);
          return acc;
        }, [] as number[]);
        if (train.length > 0 && test.length > 0) {
          splits.push({ trainIndices: train, testIndices: test });
        }
      }
      return splits;
    }

    // Default step size for non-season modes (e.g., chunks of 10% or a fixed window)
    const step = this.windowSize || Math.floor(datasetSize / 5);
    
    if (this.mode === 'expanding') {
      let currentTrainEnd = step;
      while (currentTrainEnd + step <= datasetSize) {
        const train = Array.from({length: currentTrainEnd}, (_, i) => i);
        const test = Array.from({length: step}, (_, i) => currentTrainEnd + i);
        splits.push({ trainIndices: train, testIndices: test });
        currentTrainEnd += step;
      }
    } else if (this.mode === 'rolling' && this.windowSize) {
       for (let start = 0; start + this.windowSize * 2 <= datasetSize; start += this.windowSize) {
         const train = Array.from({length: this.windowSize}, (_, i) => start + i);
         const test = Array.from({length: this.windowSize}, (_, i) => start + this.windowSize + i);
         splits.push({ trainIndices: train, testIndices: test });
       }
    } else if (this.mode === 'sliding' && this.windowSize) {
      // Similar to rolling but test window might be smaller
      let start = 0;
      while (start + this.windowSize < datasetSize) {
         const train = Array.from({length: this.windowSize}, (_, i) => start + i);
         const testEnd = Math.min(datasetSize, start + this.windowSize + Math.floor(this.windowSize/2));
         const testSize = testEnd - (start + this.windowSize);
         const test = Array.from({length: testSize}, (_, i) => start + this.windowSize + i);
         splits.push({ trainIndices: train, testIndices: test });
         start += Math.floor(this.windowSize / 2); // slide forward by half window
      }
    }

    return splits;
  }
}
