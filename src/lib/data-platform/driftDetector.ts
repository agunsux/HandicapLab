// HandicapLab Data Platform - Concept Drift Detection
export interface DriftMetrics {
  psi: number;          // Population Stability Index
  jsd: number;          // Jensen-Shannon Divergence
  isDrifting: boolean;
}

export class DriftDetector {
  /**
   * Calculates the Population Stability Index (PSI) between a reference distribution
   * (e.g., training set) and an observation distribution (e.g., test set).
   */
  public static calculatePSI(referenceData: number[], observationData: number[], numBins: number = 10): number {
    if (referenceData.length === 0 || observationData.length === 0) return 0;
    
    // 1. Determine min and max across both sets
    let min = Math.min(...referenceData, ...observationData);
    let max = Math.max(...referenceData, ...observationData);
    
    // Add small buffer to include bounds
    min -= 0.0001;
    max += 0.0001;
    
    const binWidth = (max - min) / numBins;
    
    const refCounts = new Array(numBins).fill(0);
    const obsCounts = new Array(numBins).fill(0);
    
    // 2. Bin the data
    for (const val of referenceData) {
      let bin = Math.floor((val - min) / binWidth);
      if (bin >= numBins) bin = numBins - 1;
      refCounts[bin]++;
    }
    
    for (const val of observationData) {
      let bin = Math.floor((val - min) / binWidth);
      if (bin >= numBins) bin = numBins - 1;
      obsCounts[bin]++;
    }
    
    // 3. Calculate PSI
    let psi = 0;
    for (let i = 0; i < numBins; i++) {
      // Add small epsilon to avoid division by zero or log(0)
      const refPct = Math.max(0.0001, refCounts[i] / referenceData.length);
      const obsPct = Math.max(0.0001, obsCounts[i] / observationData.length);
      
      psi += (obsPct - refPct) * Math.log(obsPct / refPct);
    }
    
    return psi;
  }
  
  /**
   * Calculates the Jensen-Shannon Divergence (JSD).
   */
  public static calculateJSD(referenceData: number[], observationData: number[], numBins: number = 10): number {
    if (referenceData.length === 0 || observationData.length === 0) return 0;
    
    const min = Math.min(...referenceData, ...observationData) - 0.0001;
    const max = Math.max(...referenceData, ...observationData) + 0.0001;
    const binWidth = (max - min) / numBins;
    
    const refCounts = new Array(numBins).fill(0);
    const obsCounts = new Array(numBins).fill(0);
    
    for (const val of referenceData) {
      const bin = Math.min(numBins - 1, Math.floor((val - min) / binWidth));
      refCounts[bin]++;
    }
    
    for (const val of observationData) {
      const bin = Math.min(numBins - 1, Math.floor((val - min) / binWidth));
      obsCounts[bin]++;
    }
    
    const p = refCounts.map(c => Math.max(0.0001, c / referenceData.length));
    const q = obsCounts.map(c => Math.max(0.0001, c / observationData.length));
    
    const m = p.map((val, i) => 0.5 * (val + q[i]));
    
    const klDivergence = (dist1: number[], dist2: number[]) => {
      let kl = 0;
      for (let i = 0; i < dist1.length; i++) {
        kl += dist1[i] * Math.log(dist1[i] / dist2[i]);
      }
      return kl;
    };
    
    const jsd = 0.5 * klDivergence(p, m) + 0.5 * klDivergence(q, m);
    return jsd;
  }
  
  /**
   * Check for drift using both PSI and JSD.
   * Standard threshold for PSI: > 0.2 indicates significant shift, 0.1-0.2 indicates minor shift.
   */
  public static detectDrift(referenceData: number[], observationData: number[], psiThreshold = 0.2, jsdThreshold = 0.1): DriftMetrics {
      const psi = this.calculatePSI(referenceData, observationData);
      const jsd = this.calculateJSD(referenceData, observationData);
      
      const isDrifting = psi > psiThreshold || jsd > jsdThreshold;
      
      return { psi, jsd, isDrifting };
  }
}
