import { CanonicalMatch } from '../../core/interfaces/MatchDataImporter';
import { BookmakerNormalizer } from './bookmakerNormalizer';
import { TeamAliasResolver } from './teamAliasResolver';
import { LeagueAliasResolver } from './leagueAliasResolver';

export class FootballDataParser {
  /**
   * Parses Football-Data.co.uk CSV strings into standardized CanonicalMatch objects.
   */
  public parse(csvContent: string): CanonicalMatch[] {
    const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      throw new Error('[FootballDataParser] Empty or invalid CSV file');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const requiredHeaders = ['Div', 'Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR'];
    for (const req of requiredHeaders) {
      if (!headers.includes(req)) {
        throw new Error(`[FootballDataParser] Missing required header: "${req}"`);
      }
    }

    const matches: CanonicalMatch[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length !== headers.length) {
        // Skip malformed rows
        continue;
      }

      // Map values based on header indices
      const getVal = (headerName: string): string => {
        const idx = headers.indexOf(headerName);
        return idx !== -1 ? cols[idx] : '';
      };

      const rawDiv = getVal('Div');
      const rawDate = getVal('Date');
      const rawTime = getVal('Time') || '15:00';
      const rawHome = getVal('HomeTeam');
      const rawAway = getVal('AwayTeam');
      const rawFthg = getVal('FTHG');
      const rawFtag = getVal('FTAG');
      const rawFtr = getVal('FTR');

      // Date parsing validation
      if (!rawDate.includes('/') && !rawDate.includes('-')) {
        throw new Error(`[FootballDataParser] Invalid date format on row ${i}: "${rawDate}"`);
      }

      // Statistics mapping
      const statistics: Record<string, { home: number; away: number }> = {};
      const addStat = (canonicalKey: string, homeHeader: string, awayHeader: string) => {
        const homeVal = Number(getVal(homeHeader));
        const awayVal = Number(getVal(awayHeader));
        if (!isNaN(homeVal) && !isNaN(awayVal)) {
          statistics[canonicalKey] = { home: homeVal, away: awayVal };
        }
      };

      addStat('shots', 'HS', 'AS');
      addStat('shotsOnTarget', 'HST', 'AST');
      addStat('corners', 'HC', 'AC');
      addStat('yellowCards', 'HY', 'AY');
      addStat('redCards', 'HR', 'AR');

      // Odds mapping (Moneyline odds Bet365/Pinnacle)
      const markets: Record<string, Record<string, { price: number; type: 'opening' | 'closing' }>> = {};
      const addOdds = (bookmakerCode: string, marketType: string, selectKey: string, headerName: string, oddsType: 'opening' | 'closing') => {
        const price = Number(getVal(headerName));
        if (!isNaN(price) && price > 1.0) {
          const canonicalBookmaker = BookmakerNormalizer.normalize(bookmakerCode);
          if (!markets[canonicalBookmaker]) {
            markets[canonicalBookmaker] = {};
          }
          markets[canonicalBookmaker][`${marketType}_${selectKey}`] = { price, type: oddsType };
        }
      };

      // Bet365 Moneyline (B365H, B365D, B365A)
      addOdds('B365', '1X2', 'Home', 'B365H', 'closing');
      addOdds('B365', '1X2', 'Draw', 'B365D', 'closing');
      addOdds('B365', '1X2', 'Away', 'B365A', 'closing');

      // Pinnacle Moneyline (PSH, PSD, PSA)
      addOdds('PS', '1X2', 'Home', 'PSH', 'closing');
      addOdds('PS', '1X2', 'Draw', 'PSD', 'closing');
      addOdds('PS', '1X2', 'Away', 'PSA', 'closing');

      matches.push({
        provider: 'football-data.co.uk',
        providerVersion: '1.0.0',
        league: LeagueAliasResolver.resolve(rawDiv),
        season: '2025/2026',
        date: rawDate,
        kickoff: rawTime,
        homeTeam: TeamAliasResolver.resolve(rawHome),
        awayTeam: TeamAliasResolver.resolve(rawAway),
        result: rawFtr,
        statistics,
        bookmakers: Object.keys(markets),
        markets,
        metadata: { rowNumber: i }
      });
    }

    return matches;
  }
}
