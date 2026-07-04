import { getPredictionsByMatchId } from './match';
import { mapMarketOdds, MatchMarketData } from '../utils/marketMapper';

export async function getMarketDataByMatchId(matchId: string): Promise<MatchMarketData | null> {
  try {
    const predictions = await getPredictionsByMatchId(matchId);
    if (!predictions || predictions.length === 0) {
      return {
        matchId,
        moneyline: null,
        asianHandicap: null,
        overUnder: null
      };
    }
    return mapMarketOdds(predictions);
  } catch (err: any) {
    console.error(`[Market Service] getMarketDataByMatchId error for ID ${matchId}:`, err.message);
    return null;
  }
}
export type { MatchMarketData, MarketOdds, OddsQuote } from '../utils/marketMapper';
