export interface CanonicalMatch {
  provider: string;
  providerVersion: string;
  league: string;
  season: string;
  date: string;
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  result: string;
  statistics: Record<string, { home: number; away: number }>;
  bookmakers: string[];
  markets: Record<string, Record<string, { price: number; type: 'opening' | 'closing' }>>;
  metadata: Record<string, any>;
}

export interface IngestionSummary {
  provider: string;
  league: string;
  season: string;
  matchesImported: number;
  bookmakersCount: number;
  oddsImported: number;
  statisticsImported: number;
  missingValues: number;
  duplicateRows: number;
  failedRows: number;
  executionTimeMs: number;
  memoryUsageBytes: number;
  integrityScore: number;
  qualityScore: number;
}

export interface MatchDataImporter {
  getName(): string;
  importCSV(csvContent: string): Promise<IngestionSummary>;
}
