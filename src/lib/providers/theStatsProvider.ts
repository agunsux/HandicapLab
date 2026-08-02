import { BaseProvider } from './baseProvider';
import { getProviderConfig } from '../data/providers/core/config';
import { Provider } from './quotaManager';

export class TheStatsProvider extends BaseProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    super('thestatsapi');
    const config = getProviderConfig().theStatsApi;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  /**
   * Discovers fixtures for today, tomorrow, and +48h.
   */
  async getFixtures(): Promise<any[]> {
    const url = `${this.baseUrl}/fixtures/discovery`;
    
    // Priority 60 for discovery
    const response = await this.fetchWithQuota('fixtures', url, 60, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return data;
  }

  /**
   * Health check
   */
  async getHealth(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/health`;
      const response = await this.fetchWithQuota('health', url, 100, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
