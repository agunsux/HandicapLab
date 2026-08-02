import { BaseProvider } from './baseProvider';
import { getProviderConfig, SupportedMarket, SharpBookmaker } from '../data/providers/core/config';

export class OddsPapiProvider extends BaseProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    super('oddspapi');
    const config = getProviderConfig().oddsPapi;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  /**
   * Fetches odds for the specific supported markets and sharp bookmakers.
   */
  async getOdds(sportKey: string, eventId: string): Promise<any> {
    const markets = Object.values(SupportedMarket).join(',');
    const bookmakers = Object.values(SharpBookmaker).join(',');
    
    // According to OddsPAPI documentation, typical endpoint for event odds:
    // /sports/{sport}/events/{eventId}/odds?apiKey={key}&regions=us,eu&bookmakers=...&markets=...
    const url = `${this.baseUrl}/sports/${sportKey}/events/${eventId}/odds?apiKey=${this.apiKey}&bookmakers=${bookmakers}&markets=${markets}`;

    // Priority 80 for odds (higher than discovery)
    const response = await this.fetchWithQuota('odds', url, 80);
    const data = await response.json();
    return data;
  }

  /**
   * Health check
   */
  async getHealth(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/sports?apiKey=${this.apiKey}`;
      const response = await this.fetchWithQuota('health', url, 100);
      return response.ok;
    } catch {
      return false;
    }
  }
}
