import { BaseProvider } from './baseProvider';
import { getProviderConfig } from '../data/providers/core/config';
import { FixtureContext, shouldEnrichFixture } from './importanceScore';

export class ApiFootballProvider extends BaseProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    super('apifootball');
    const config = getProviderConfig().apiFootball;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  private get defaultHeaders() {
    return {
      'x-apisports-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private assertNoErrors(data: any, endpoint: string): void {
    if (!data) return;
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      throw new Error(`[API-Football] Error on /${endpoint}: ${JSON.stringify(data.errors)}`);
    }
    if (data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors) && Object.keys(data.errors).length > 0) {
      const msg = data.errors.access || data.errors.token || JSON.stringify(data.errors);
      throw new Error(`[API-Football] Provider error on /${endpoint}: ${msg}`);
    }
  }

  /**
   * Universal fetch for API-Football ensuring we only enrich important fixtures.
   */
  private async fetchEnrichmentData(endpoint: string, fixtureId: string, context: FixtureContext): Promise<any> {
    if (!shouldEnrichFixture(context)) {
      console.log(`[API-Football] Skipping enrichment for fixture ${fixtureId} due to low Importance Score.`);
      return null;
    }

    const url = `${this.baseUrl}/${endpoint}?fixture=${fixtureId}`;
    
    // Priority 90 for targeted enrichment
    const response = await this.fetchWithQuota(endpoint, url, 90, {
      headers: this.defaultHeaders
    });

    const data = await response.json();
    this.assertNoErrors(data, endpoint);
    return data;
  }

  async getLineups(fixtureId: string, context: FixtureContext): Promise<any> {
    return this.fetchEnrichmentData('lineups', fixtureId, context);
  }

  async getInjuries(fixtureId: string, context: FixtureContext): Promise<any> {
    return this.fetchEnrichmentData('injuries', fixtureId, context);
  }
  
  async getH2H(h2hString: string, context: FixtureContext): Promise<any> {
    if (!shouldEnrichFixture(context)) {
      return null;
    }

    // endpoint h2h requires h2h=id-id
    const url = `${this.baseUrl}/fixtures/headtohead?h2h=${h2hString}`;
    
    const response = await this.fetchWithQuota('fixtures', url, 90, {
      headers: this.defaultHeaders
    });

    const data = await response.json();
    this.assertNoErrors(data, 'fixtures/headtohead');
    return data;
  }

  async getFixturesByDate(dateStr: string): Promise<any> {
    const url = `${this.baseUrl}/fixtures?date=${dateStr}`;
    const response = await this.fetchWithQuota('fixtures', url, 100, {
      headers: this.defaultHeaders
    });
    const data = await response.json();
    this.assertNoErrors(data, 'fixtures');
    return data;
  }

  /**
   * Health check
   */
  async getHealth(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/status`;
      const response = await this.fetchWithQuota('health', url, 100, {
        headers: this.defaultHeaders
      });
      if (!response.ok) return false;
      const data = await response.json();
      if (data?.errors && (Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors).length > 0)) {
        return false;
      }
      return data?.response?.account?.active === true;
    } catch {
      return false;
    }
  }
}
