// HandicapLab Market Intelligence - Local Repository Layer
// Location: src/lib/data/marketLogRepository.ts

import fs from 'fs';
import path from 'path';

export interface MarketSnapshotRecord {
  matchId: string;
  openingOdds: { home: number; draw: number; away: number };
  openingProbability: number;
  timestamp: string;
  provider: string;
  marketVersion: string;
  oddsHash: string;
}

export interface MarketMovementRecord {
  matchId: string;
  timestamp: string;
  bookmaker: string;
  market: 'ML' | 'AH' | 'OU';
  selection: string;
  oldOdds: number;
  newOdds: number;
  movementMagnitude: number;
  movementDirection: 'up' | 'down' | 'neutral';
}

export interface CLVResultRecord {
  matchId: string;
  predictedSelection: string;
  openingOdds: number;
  currentOdds: number;
  closingOdds: number;
  clvPercent: number;
  expectedEdge: number;
  valueLost: number;
  valueGained: number;
  reasons: string[];
}

export interface MarketScoreRecord {
  matchId: string;
  stabilityScore: number;
  liquidityScore: number;
  consensusScore: number;
  volatilityScore: number;
  overallScore: number;
  timestamp: string;
}

export class MarketLogRepository {
  private static artifactDir = 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\b0e51ad4-db7e-4196-9e0e-e58ff37caeeb\\artifacts';
  
  private static snapshots: MarketSnapshotRecord[] = [];
  private static movements: MarketMovementRecord[] = [];
  private static clvResults: CLVResultRecord[] = [];
  private static scores: MarketScoreRecord[] = [];

  private static getFilePath(name: string): string {
    return path.join(this.artifactDir, `${name}.json`);
  }

  private static load<T>(name: string, fallback: T[]): T[] {
    const file = this.getFilePath(name);
    if (fs.existsSync(file)) {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  private static save<T>(name: string, data: T[]): void {
    if (!fs.existsSync(this.artifactDir)) {
      fs.mkdirSync(this.artifactDir, { recursive: true });
    }
    fs.writeFileSync(this.getFilePath(name), JSON.stringify(data, null, 2), 'utf8');
  }

  // Snapshots
  public static appendSnapshot(record: MarketSnapshotRecord): void {
    const data = this.load<MarketSnapshotRecord>('market_snapshots', []);
    data.push(record);
    this.save('market_snapshots', data);
    this.snapshots = data;
  }

  public static getSnapshots(): MarketSnapshotRecord[] {
    return this.load<MarketSnapshotRecord>('market_snapshots', this.snapshots);
  }

  // Movements
  public static appendMovement(record: MarketMovementRecord): void {
    const data = this.load<MarketMovementRecord>('market_movements', []);
    data.push(record);
    this.save('market_movements', data);
    this.movements = data;
  }

  public static getMovements(matchId?: string): MarketMovementRecord[] {
    const all = this.load<MarketMovementRecord>('market_movements', this.movements);
    return matchId ? all.filter((m) => m.matchId === matchId) : all;
  }

  // CLV Results
  public static appendCLV(record: CLVResultRecord): void {
    const data = this.load<CLVResultRecord>('clv_results', []);
    // Avoid duplicates for same matchId
    const filtered = data.filter((d) => d.matchId !== record.matchId);
    filtered.push(record);
    this.save('clv_results', filtered);
    this.clvResults = filtered;
  }

  public static getCLVResults(): CLVResultRecord[] {
    return this.load<CLVResultRecord>('clv_results', this.clvResults);
  }

  // Scores
  public static appendScore(record: MarketScoreRecord): void {
    const data = this.load<MarketScoreRecord>('market_scores', []);
    const filtered = data.filter((d) => d.matchId !== record.matchId);
    filtered.push(record);
    this.save('market_scores', filtered);
    this.scores = filtered;
  }

  public static getScores(): MarketScoreRecord[] {
    return this.load<MarketScoreRecord>('market_scores', this.scores);
  }

  /**
   * Reset helper for test isolated runs.
   */
  public static clear(): void {
    this.snapshots = [];
    this.movements = [];
    this.clvResults = [];
    this.scores = [];
    
    const files = ['market_snapshots', 'market_movements', 'clv_results', 'market_scores'];
    files.forEach((f) => {
      const p = this.getFilePath(f);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
    });
  }
}
