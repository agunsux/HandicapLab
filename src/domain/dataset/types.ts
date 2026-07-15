/**
 * SUPER EPIC 31B.5 — Dataset Domain Types
 */

export type SourceType = 'historical_archive' | 'live_api' | 'research_dataset';

export interface DatasetMetadata {
  datasetId: string;
  source: string;
  sourceType: SourceType;
  league: string;
  season: string;
  coverage: {
    matchesCount: number;
    startDate: string;
    endDate: string;
  };
  hash: string; // SHA256 Checksum
  downloadTimestamp: string;
  openingOddsCompleteness: number; // percentage (0 - 100)
  closingOddsCompleteness: number; // percentage (0 - 100)
  ahCompleteness: number; // percentage (0 - 100)
  ouCompleteness: number; // percentage (0 - 100)
  xGAvailability: boolean;
  bookmakerCoverage: string[];
  verificationStatus: 'Verified' | 'Unverified';
  dataQualityScore: number; // score (0 - 100)
  crowdAttendanceRegimeCoverage: {
    full: number;
    limited: number;
    closedDoor: number;
    unknown: number;
  };
  filePath: string;
  auditNotes: string[];
}
