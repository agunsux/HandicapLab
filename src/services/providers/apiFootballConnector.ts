import axios from 'axios';

export interface APIFootballConfig {
  apiKey: string;
  baseUrl: string;
  rateLimitMs: number;
}

export class APIFootballConnector {
  private readonly config: APIFootballConfig;

  constructor(config?: Partial<APIFootballConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.API_FOOTBALL_KEY || 'mock-api-key',
      baseUrl: config?.baseUrl || 'https://v3.football.api-sports.io',
      rateLimitMs: config?.rateLimitMs || 100 // 10 requests per second (100ms interval)
    };
  }

  /**
   * Fetches data from API-Football endpoints with rate limits and backoff retries.
   */
  public async fetchWithRetry<T>(endpoint: string, params: Record<string, any> = {}, maxRetries = 3): Promise<T> {
    let attempts = 0;
    let delay = 1000; // Starting backoff delay of 1 second

    while (attempts < maxRetries) {
      try {
        // Enforce rate limiting delay
        await new Promise(resolve => setTimeout(resolve, this.config.rateLimitMs));

        const response = await axios.get(`${this.config.baseUrl}/${endpoint}`, {
          headers: {
            'x-apisports-key': this.config.apiKey
          },
          params
        });

        // API-Football returns errors inside the 200 OK body sometimes
        if (response.data?.errors && Object.keys(response.data.errors).length > 0) {
          const errMsg = JSON.stringify(response.data.errors);
          if (errMsg.includes('limit') || response.status === 429) {
            throw new Error(`[APIFootballConnector] Rate limit error: ${errMsg}`);
          }
          throw new Error(`[APIFootballConnector] API Error: ${errMsg}`);
        }

        return response.data?.response as T;
      } catch (err: any) {
        attempts++;
        if (attempts >= maxRetries) {
          throw new Error(`[APIFootballConnector] Fetch failed after ${maxRetries} attempts: ${err.message}`);
        }

        console.warn(`[APIFootballConnector] Attempt ${attempts} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff scaling
      }
    }

    throw new Error('[APIFootballConnector] Unreachable state');
  }
}
