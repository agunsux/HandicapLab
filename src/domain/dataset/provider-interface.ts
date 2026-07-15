import { CanonicalFixture, CanonicalOdds } from './canonical';

export interface ProviderCapability {
  supportsMoneyline: boolean;
  supportsAsianHandicap: boolean;
  supportsOverUnder: boolean;
  supportsHistorical: boolean;
  supportsXG: boolean;
}

export interface HistoricalDataProvider {
  name: string;
  version: string;
  getCapabilities(): ProviderCapability;
  fetchFixtures(competitionId: string, seasonId: string): Promise<Partial<CanonicalFixture>[]>;
  fetchOdds(competitionId: string, seasonId: string): Promise<CanonicalOdds[]>;
}
