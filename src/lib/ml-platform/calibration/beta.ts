import { ICalibrator, CalibratedOutput } from './interface';

export class BetaCalibrator implements ICalibrator {
  private params: Array<{ a: number; b: number; c: number }> = [];
  
  // Histogram for density/uncertainty estimation
  private bins: number = 20;
  private density: number[][] = []; 
  
  constructor() {}

  public fit(rawProbs: number[][], actualOutcomes: number[][], sampleWeights?: number[]): void {
    if (rawProbs.length === 0) return;
    const numClasses = rawProbs[0].length;
    this.params = Array(numClasses).fill({ a: 1, b: 1, c: 0 });
    this.density = Array.from({ length: numClasses }, () => Array(this.bins).fill(0));
    
    // Fit One-vs-Rest for each class using basic Gradient Descent MLE
    for (let cIndex = 0; cIndex < numClasses; cIndex++) {
      let a = 1.0;
      let b = 1.0;
      let c = 0.0;
      
      const learningRate = 0.001;
      const epochs = 500;
      
      for (let epoch = 0; epoch < epochs; epoch++) {
        let gradA = 0, gradB = 0, gradC = 0;
        
        for (let i = 0; i < rawProbs.length; i++) {
          const p = Math.max(0.0001, Math.min(0.9999, rawProbs[i][cIndex]));
          const y = actualOutcomes[i][cIndex];
          const w = sampleWeights ? sampleWeights[i] : 1.0;
          
          const logP = Math.log(p);
          const log1mP = Math.log(1 - p);
          
          const z = a * logP - b * log1mP + c;
          const pTrue = 1 / (1 + Math.exp(-z));
          
          const error = (pTrue - y) * w;
          
          gradA += error * logP;
          gradB += error * (-log1mP);
          gradC += error;
          
          // Density tracking for uncertainty (only on final epoch)
          if (epoch === epochs - 1) {
             const bin = Math.min(this.bins - 1, Math.floor(p * this.bins));
             this.density[cIndex][bin] += w;
          }
        }
        
        a -= learningRate * gradA;
        b -= learningRate * gradB;
        c -= learningRate * gradC;
        
        // Beta parameters must be positive
        a = Math.max(0.01, a);
        b = Math.max(0.01, b);
      }
      
      this.params[cIndex] = { a, b, c };
    }
  }
  
  public transform(rawProbs: number[]): CalibratedOutput {
    if (this.params.length === 0) throw new Error("Calibrator not fitted.");
    
    let calibrated = [];
    let minDensity = Infinity;
    
    for (let cIndex = 0; cIndex < rawProbs.length; cIndex++) {
      const p = Math.max(0.0001, Math.min(0.9999, rawProbs[cIndex]));
      const { a, b, c } = this.params[cIndex];
      
      const logP = Math.log(p);
      const log1mP = Math.log(1 - p);
      const z = a * logP - b * log1mP + c;
      const pTrue = 1 / (1 + Math.exp(-z));
      calibrated.push(pTrue);
      
      // Calculate uncertainty based on sample density in that bin
      const bin = Math.min(this.bins - 1, Math.floor(p * this.bins));
      const binCount = this.density[cIndex][bin];
      minDensity = Math.min(minDensity, binCount);
    }
    
    // Normalize safely to sum to 1.0
    const sum = calibrated.reduce((s, v) => s + v, 0);
    if (sum > 0) {
      calibrated = calibrated.map(v => v / sum);
    }
    
    // Uncertainty: 0.0 if we have >= 50 samples in bin, scaling up to 1.0 if 0 samples
    let uncertaintyScore = Math.max(0, 1 - (minDensity / 50));
    // Clamp to 1.0 max
    uncertaintyScore = Math.min(1.0, uncertaintyScore);
    
    return { probabilities: calibrated, uncertaintyScore };
  }
  
  public exportState(): string {
    return JSON.stringify({ params: this.params, density: this.density });
  }
  
  public importState(state: string): void {
    const data = JSON.parse(state);
    this.params = data.params;
    this.density = data.density;
  }
}
