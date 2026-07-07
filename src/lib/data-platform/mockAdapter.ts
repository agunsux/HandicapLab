// HandicapLab Live Data Platform - Mock Adapter
// Location: src/lib/data-platform/mockAdapter.ts

import { OddsProvider, ProviderCapability } from './providerInterface';
import { CanonicalFixture, CanonicalOdds } from './canonicalModel';

export class MockOddsProvider implements OddsProvider {
  public name = 'Mock';

  public getCapabilities(): ProviderCapability {
    return {
      supportsMoneyline: true,
      supportsAsianHandicap: true,
      supportsOverUnder: true,
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

  public async health(): Promise<{ status: 'healthy'; latency: number }> {
    return { status: 'healthy', latency: 4 };
  }

  public async authenticate(): Promise<boolean> {
    return true;
  }

  public async getFixtures(): Promise<CanonicalFixture[]> {
    return [
      {
        match_id: 'mock-match-1',
        provider_id: 'm-1',
        provider: 'Mock',
        competition_id: '39',
        season: '2023-2024',
        home_team_id: '1',
        away_team_id: '2',
        kickoff: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        home_goals: null,
        away_goals: null,
        home_xg: null,
        away_xg: null,
        home_shots: null,
        away_shots: null,
        home_shots_on_target: null,
        away_shots_on_target: null,
        status: 'SCHEDULED',
        schema_version: '1.0.0',
        generated_at: new Date().toISOString(),
        checksum: 'dummy'
      }
    ];
  }

  public async getOdds(fixtureId: string): Promise<CanonicalOdds[]> {
    const now = new Date().toISOString();
    return [
      {
        fixtureId,
        provider: 'Mock',
        marketType: 'ML',
        selection: 'home',
        oddsDecimal: 2.10,
        impliedProbability: 1 / 2.10,
        receivedAt: now,
        providerTimestamp: now,
        processedTimestamp: now,
        latencyMs: 5,
        normalizerVersion: '1.0.0'
      },
      {
        fixtureId,
        provider: 'Mock',
        marketType: 'ML',
        selection: 'draw',
        oddsDecimal: 3.30,
        impliedProbability: 1 / 3.30,
        receivedAt: now,
        providerTimestamp: now,
        processedTimestamp: now,
        latencyMs: 5,
        normalizerVersion: '1.0.0'
      },
      {
        fixtureId,
        provider: 'Mock',
        marketType: 'ML',
        selection: 'away',
        oddsDecimal: 3.50,
        impliedProbability: 1 / 3.50,
        receivedAt: now,
        providerTimestamp: now,
        processedTimestamp: now,
        latencyMs: 5,
        normalizerVersion: '1.0.0'
      }
    ];
  }

  public async subscribe(): Promise<boolean> {
    return true;
  }

  public async unsubscribe(): Promise<boolean> {
    return true;
  }
}
