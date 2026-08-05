export interface ProviderConfig {
  id: string;
  name: string;
  providerType: 'fixtures' | 'xg' | 'odds' | 'ratings' | 'stats' | 'market_value';
  baseUrl?: string;
  rateLimitPerMin: number;
  isActive: boolean;
}

export const PROVIDER_CATALOG: ProviderConfig[] = [
  {
    id: 'football_data',
    name: 'Football-Data.co.uk',
    providerType: 'fixtures',
    baseUrl: 'https://www.football-data.co.uk',
    rateLimitPerMin: 120,
    isActive: true,
  },
  {
    id: 'understat',
    name: 'Understat',
    providerType: 'xg',
    baseUrl: 'https://understat.com',
    rateLimitPerMin: 60,
    isActive: true,
  },
  {
    id: 'club_elo',
    name: 'ClubElo',
    providerType: 'ratings',
    baseUrl: 'http://api.clubelo.com',
    rateLimitPerMin: 60,
    isActive: true,
  },
  {
    id: 'api_football',
    name: 'API-Football',
    providerType: 'fixtures',
    baseUrl: 'https://v3.football.api-sports.io',
    rateLimitPerMin: 100,
    isActive: true,
  },
  {
    id: 'oddspapi',
    name: 'OddsPAPI',
    providerType: 'odds',
    baseUrl: 'https://api.oddspapi.com/v1',
    rateLimitPerMin: 120,
    isActive: true,
  },
  {
    id: 'fbref',
    name: 'FBref',
    providerType: 'stats',
    baseUrl: 'https://fbref.com',
    rateLimitPerMin: 30,
    isActive: true,
  },
  {
    id: 'open_football',
    name: 'OpenFootball',
    providerType: 'fixtures',
    baseUrl: 'https://github.com/openfootball',
    rateLimitPerMin: 300,
    isActive: true,
  },
  {
    id: 'transfermarkt',
    name: 'Transfermarkt',
    providerType: 'market_value',
    baseUrl: 'https://www.transfermarkt.com',
    rateLimitPerMin: 30,
    isActive: false, // Optional / Tier 3
  },
];

export class ProviderRegistryManager {
  private providers: Map<string, ProviderConfig> = new Map();

  constructor() {
    PROVIDER_CATALOG.forEach((p) => this.providers.set(p.id, p));
  }

  getProvider(id: string): ProviderConfig | undefined {
    return this.providers.get(id);
  }

  getActiveProviders(): ProviderConfig[] {
    return Array.from(this.providers.values()).filter((p) => p.isActive);
  }

  registerProvider(config: ProviderConfig): void {
    this.providers.set(config.id, config);
  }
}

export const providerRegistryManager = new ProviderRegistryManager();
