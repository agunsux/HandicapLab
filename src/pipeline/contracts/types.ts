export interface CanonicalTeam {
  canonicalId: string;
  aliases: string[];
}

export interface FootballDataRecord {
  date: string; // YYYY-MM-DD
  homeTeam: string;
  awayTeam: string;
  fthg: number;
  ftag: number;
  hs: number;
  as: number;
  hst: number;
  ast: number;
  hc: number;
  ac: number;
  hy: number;
  ay: number;
  hr: number;
  ar: number;
  b365h: number;
  b365d: number;
  b365a: number;
  [key: string]: any; // other odds
}

export interface UnderstatRecord {
  date: string; // YYYY-MM-DD
  homeTeam: string;
  awayTeam: string;
  homeXg: number;
  awayXg: number;
  homeGoals: number;
  awayGoals: number;
  [key: string]: any;
}

export interface SilverFixture {
  fixtureId: string; // Canonical deterministic ID
  date: string; // ISO 8601 YYYY-MM-DD
  timestamp: number; // Unix epoch ms
  season: string; // e.g. "2023-2024"
  homeTeam: string; // Canonical ID
  awayTeam: string; // Canonical ID
  footballData: FootballDataRecord;
  understat: UnderstatRecord;
  metadata: {
    mergeConfidence: number;
    checksum: string;
  };
}

export interface RollingWindow {
  short: number; // 5
  medium: number; // 10
  long: number; // 20
}

export interface HistoricalFeatures {
  fixtureId: string;
  timestamp: number; // Must be < fixture.timestamp
  homeTeam: string;
  awayTeam: string;
  // Features (80-150 expected)
  [featureName: string]: number | string;
}

export interface GoldDatasetRecord {
  fixtureId: string;
  season: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  features: Record<string, number | string>;
  target: any; // Context specific (ML, AH, OU)
  metadata: {
    dataset_version: string;
    checksum: string;
    git_commit: string;
    build_time: string;
    pipeline_version: string;
  };
}

export interface WalkForwardFold {
  trainSeasons: string[];
  validationSeasons: string[];
  testSeasons: string[];
}
