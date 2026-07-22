// EPIC 40 — Model Evolution Timeline Engine
// Maintains versioned history of model iterations from v1.00 to v1.40.0.

export interface ReleaseNode {
  version: string;
  name: string;
  releaseDate: string;
  acceptedFeatures: string[];
  rejectedFeatures: string[];
  roiDeltaPct: number;
  description: string;
}

export class ModelTimelineEngine {
  private static TIMELINE: ReleaseNode[] = [
    { version: 'v1.40.0', name: 'Public Ledger & Transparency Platform', releaseDate: '2026-07-23', acceptedFeatures: ['Append-Only Public Ledger', 'SHA256 Verifier', 'Automated Reports', 'Hall of Shame Postmortems'], rejectedFeatures: [], roiDeltaPct: 0.0, description: 'Transformed HandicapLab into an open scientific research institution with public auditability.' },
    { version: 'v1.39.0', name: 'Data Quality & Integrity Platform', releaseDate: '2026-07-22', acceptedFeatures: ['0-100 Quality Score', 'Automated Integrity Checkers', 'Feature Drift Detector', 'Lineage Visualizer'], rejectedFeatures: ['Raw Wind Speed Feature'], roiDeltaPct: 1.8, description: 'Continuous data quality evaluation, zero-duplicate enforcement, and experiment registry.' },
    { version: 'v1.38.0', name: 'Quantitative Market Intelligence Platform', releaseDate: '2026-07-22', acceptedFeatures: ['Market Quality Score', 'EV Decay Engine', 'Closing Line Intelligence', 'Meta Value Score', 'Portfolio Risk'], rejectedFeatures: [], roiDeltaPct: 2.1, description: 'Pre-match market evaluation, EV decay curves, and Quarter-Kelly risk optimization.' },
    { version: 'v1.37.0', name: 'Scientific Validation Platform', releaseDate: '2026-07-22', acceptedFeatures: ['Forecast Archive', 'Calibration Lab', '95% Wilson CIs', 'k-NN Feature Similarity v2'], rejectedFeatures: [], roiDeltaPct: 1.4, description: '6-layer scientific validation framework, Brier score, ECE, and k-NN match search.' },
    { version: 'v1.36.0', name: 'Value Betting Intelligence Platform', releaseDate: '2026-07-22', acceptedFeatures: ['Model Fair Odds vs Bookmaker Odds', '5-Tier Classifier', '5-Question Explainability'], rejectedFeatures: [], roiDeltaPct: 2.5, description: 'Positioned HandicapLab as a Value Betting Intelligence Platform (FootyStats + RebelBetting).' },
    { version: 'v1.00', name: 'Baseline Poisson Engine', releaseDate: '2025-10-01', acceptedFeatures: ['Basic Goal Intensity Poisson'], rejectedFeatures: [], roiDeltaPct: 0.0, description: 'Initial baseline model launch.' },
  ];

  /** Get complete release timeline nodes */
  static getTimeline(): ReleaseNode[] {
    return this.TIMELINE;
  }
}
