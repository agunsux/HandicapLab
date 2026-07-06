// HandicapLab Live Data Platform - File Adapter (Historical snapshot read)
// Location: src/lib/data-platform/fileAdapter.ts

import { OddsProvider, ProviderCapability } from './providerInterface';
import { CanonicalFixture, CanonicalOdds } from './canonicalModel';
import fs from 'fs';
import path from 'path';

export class FileOddsProvider implements OddsProvider {
  public name = 'File';
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\b0e51ad4-db7e-4196-9e0e-e58ff37caeeb\\artifacts\\market_snapshots.json';
  }

  public getCapabilities(): ProviderCapability {
    return {
      supportsMoneyline: true,
      supportsAsianHandicap: false,
      supportsOverUnder: false,
      supportsLiveOdds: false,
      supportsHistorical: true
    };
  }

  public async connect(): Promise<boolean> {
    return true;
  }

  public async disconnect(): Promise<boolean> {
    return true;
  }

  public async health(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    return fs.existsSync(this.filePath) 
      ? { status: 'healthy', latency: 2 }
      : { status: 'unhealthy', latency: 0 };
  }

  public async authenticate(): Promise<boolean> {
    return true;
  }

  public async getFixtures(): Promise<CanonicalFixture[]> {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as any[];
      return data.map((d) => ({
        id: d.matchId,
        providerId: d.matchId,
        provider: 'File',
        competition: { id: '39', name: 'English Premier League', region: 'England' },
        homeTeam: { id: 'h', name: 'Home' },
        awayTeam: { id: 'a', name: 'Away' },
        kickoffTime: d.timestamp || new Date().toISOString(),
        status: 'FINISHED',
        schemaVersion: '1.0.0'
      }));
    } catch {
      return [];
    }
  }

  public async getOdds(fixtureId: string): Promise<CanonicalOdds[]> {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as any[];
      const match = data.find((d) => d.matchId === fixtureId);
      if (!match) return [];

      const now = new Date().toISOString();
      return [
        {
          fixtureId,
          provider: 'File',
          marketType: 'ML',
          selection: 'home',
          oddsDecimal: match.openingOdds?.home || 2.00,
          impliedProbability: 1 / (match.openingOdds?.home || 2.00),
          receivedAt: now,
          providerTimestamp: match.timestamp || now,
          processedTimestamp: now,
          latencyMs: 1,
          normalizerVersion: '1.0.0'
        }
      ];
    } catch {
      return [];
    }
  }

  public async subscribe(): Promise<boolean> {
    return true;
  }

  public async unsubscribe(): Promise<boolean> {
    return true;
  }
}
