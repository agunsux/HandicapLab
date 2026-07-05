import { CanonicalMatch } from './MatchDataImporter';

export interface StatisticsProvider {
  extractStatistics(match: CanonicalMatch): any[];
}
