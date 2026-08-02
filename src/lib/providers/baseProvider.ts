import { acquire, logCall, Provider } from './quotaManager';

export abstract class BaseProvider {
  protected provider: Provider;
  
  constructor(provider: Provider) {
    this.provider = provider;
  }

  protected async fetchWithQuota(
    endpoint: string,
    url: string,
    priority: number,
    options?: RequestInit
  ): Promise<Response> {
    const startMs = Date.now();
    const receipt = await acquire(this.provider, endpoint, priority);
    
    if (!receipt.ok) {
      throw new Error(`[${this.provider}] Quota/Priority check failed: ${receipt.reason}`);
    }

    try {
      const response = await fetch(url, options);
      const durationMs = Date.now() - startMs;
      
      await logCall(this.provider, endpoint, durationMs, response.status, {
        url,
        priority,
        mode: receipt.mode,
      });

      if (response.status === 429) {
        throw new Error(`[${this.provider}] Received 429 Rate Limit from API.`);
      }

      if (!response.ok) {
        throw new Error(`[${this.provider}] Request failed: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      const durationMs = Date.now() - startMs;
      await logCall(this.provider, endpoint, durationMs, 500, {
        url,
        priority,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error(`[${this.provider}] Fetch error:`, error);
      throw error;
    }
  }

  abstract getHealth(): Promise<boolean>;
}
