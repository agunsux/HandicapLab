import { Provider } from './quotaManagerV4';
import { globalGateway } from './providerGateway';

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
    const response = await globalGateway.fetch(this.provider, endpoint, url, {
      ...options,
      quotaPriority: priority,
    });

    if (response.status === 429) {
      throw new Error(`[${this.provider}] Received 429 Rate Limit from API.`);
    }

    if (!response.ok) {
      throw new Error(`[${this.provider}] Request failed: HTTP ${response.status} ${response.statusText}`);
    }

    return response;
  }

  abstract getHealth(): Promise<boolean>;
}
