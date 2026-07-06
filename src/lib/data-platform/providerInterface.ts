// HandicapLab Live Data Platform - universal provider adapter interface
// Location: src/lib/data-platform/providerInterface.ts

import { CanonicalFixture, CanonicalOdds } from './canonicalModel';

export interface ProviderCapability {
  supportsMoneyline: boolean;
  supportsAsianHandicap: boolean;
  supportsOverUnder: boolean;
  supportsLiveOdds: boolean;
  supportsHistorical: boolean;
}

export interface OddsProvider {
  name: string;
  getCapabilities(): ProviderCapability;
  connect(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  health(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }>;
  authenticate(credentials: any): Promise<boolean>;
  getFixtures(): Promise<CanonicalFixture[]>;
  getOdds(fixtureId: string): Promise<CanonicalOdds[]>;
  subscribe(fixtureId: string, callback: (odds: CanonicalOdds[]) => void): Promise<boolean>;
  unsubscribe(fixtureId: string): Promise<boolean>;
}
