import { CanonicalMatch } from './MatchDataImporter';

export interface OddsProvider {
  extractOdds(match: CanonicalMatch): any[];
}
