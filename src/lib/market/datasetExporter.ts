// HandicapLab Market Intelligence - Dataset Exporter
// Location: src/lib/market/datasetExporter.ts

import fs from 'fs';
import path from 'path';

export interface ResearchRecord {
  matchId: string;
  predictedSelection: string;
  openingOdds: number;
  closingOdds: number;
  clvPercent: number;
  expectedEdge: number;
  volatilityScore: number;
  steamScore: number;
  stabilityScore: number;
  consensusScore: number;
  status: 'won' | 'lost' | 'pending';
  profitLoss: number;
  timestamp: string;
}

export class DatasetExporter {
  /**
   * Compiles finished runs and exports to JSON and CSV formats.
   */
  public static export(records: ResearchRecord[], exportDir: string): void {
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // 1. Export as JSON
    const jsonPath = path.join(exportDir, 'market_dataset_v1.json');
    fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2), 'utf8');

    // 2. Export as CSV
    const csvPath = path.join(exportDir, 'market_dataset_v1.csv');
    const headers = [
      'matchId',
      'predictedSelection',
      'openingOdds',
      'closingOdds',
      'clvPercent',
      'expectedEdge',
      'volatilityScore',
      'steamScore',
      'stabilityScore',
      'consensusScore',
      'status',
      'profitLoss',
      'timestamp'
    ];

    const lines = [headers.join(',')];
    records.forEach((r) => {
      const line = [
        r.matchId,
        r.predictedSelection,
        r.openingOdds,
        r.closingOdds,
        r.clvPercent,
        r.expectedEdge,
        r.volatilityScore,
        r.steamScore,
        r.stabilityScore,
        r.consensusScore,
        r.status,
        r.profitLoss,
        r.timestamp
      ].join(',');
      lines.push(line);
    });

    fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
  }
}
