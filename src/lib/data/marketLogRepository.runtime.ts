// HandicapLab Market Intelligence - Runtime Repository Layer
// Location: src/lib/data/marketLogRepository.runtime.ts

import type fsType from 'fs';
import type pathType from 'path';

const fs: typeof fsType.promises = eval("require('fs')").promises;
const path: typeof pathType = eval("require('path')");

// Re-export type definitions for consumers
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

  private static async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private static async load<T>(name: string, fallback: T[]): Promise<T[]> {
    const file = this.getFilePath(name);
    if (await this.exists(file)) {
      try {
        const raw = await fs.readFile(file, 'utf8');
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  private static async save<T>(name: string, data: T[]): Promise<void> {
    const file = this.getFilePath(name);
    const dir = path.dirname(file);
    if (!(await this.exists(dir))) {
      await fs.mkdir(dir, { recursive: true });
    }
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  }

  // Snapshots
  public static async appendSnapshot(record: MarketSnapshotRecord): Promise<void> {
    const data = await this.load<MarketSnapshotRecord>('market_snapshots', []);
    data.push(record);
    await this.save('market_snapshots', data);
    this.snapshots = data;
  }

  public static async getSnapshots(): Promise<MarketSnapshotRecord[]> {
    return this.load<MarketSnapshotRecord>('market_snapshots', this.snapshots);
  }

  // Movements
  public static async appendMovement(record: MarketMovementRecord): Promise<void> {
    const data = await this.load<MarketMovementRecord>('market_movements', []);
    data.push(record);
    await this.save('market_movements', data);
    this.movements = data;
  }

  public static async getMovements(matchId?: string): Promise<MarketMovementRecord[]> {
    const all = await this.load<MarketMovementRecord>('market_movements', this.movements);
    return matchId ? all.filter((m) => m.matchId === matchId) : all;
  }

  // CLV Results
  public static async appendCLV(record: CLVResultRecord): Promise<void> {
    const data = await this.load<CLVResultRecord>('clv_results', []);
    const filtered = data.filter((d) => d.matchId !== record.matchId);
    filtered.push(record);
    await this.save('clv_results', filtered);
    this.clvResults = filtered;
  }

  public static async getCLVResults(): Promise<CLVResultRecord[]> {
    return this.load<CLVResultRecord>('clv_results', this.clvResults);
  }

  // Scores
  public static async appendScore(record: MarketScoreRecord): Promise<void> {
    const data = await this.load<MarketScoreRecord>('market_scores', []);
    const filtered = data.filter((d) => d.matchId !== record.matchId);
    filtered.push(record);
    await this.save('market_scores', filtered);
    this.scores = filtered;
  }

  public static async getScores(): Promise<MarketScoreRecord[]> {
    return this.load<MarketScoreRecord>('market_scores', this.scores);
  }

  /**
   * Reset helper for test isolated runs.
   */
  public static async clear(): Promise<void> {
    this.snapshots = [];
    this.movements = [];
    this.clvResults = [];
    this.scores = [];
    
    const files = ['market_snapshots', 'market_movements', 'clv_results', 'market_scores'];
    for (const f of files) {
      const p = this.getFilePath(f);
      if (await this.exists(p)) {
        try {
          await fs.unlink(p);
        } catch {}
      }
    }
  }
}
