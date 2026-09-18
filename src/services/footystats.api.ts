import { z } from 'zod';

export const FootyStatsMatchSchema = z.object({
  id: z.number(),
  homeID: z.number(),
  awayID: z.number(),
  home_name: z.string(),
  away_name: z.string(),
  competition_name: z.string(),
  date_unix: z.number(),
  status: z.string(),
  odds_ft_1: z.number(),
  odds_ft_x: z.number(),
  odds_ft_2: z.number(),
  odds_btts_yes: z.number(),
  odds_btts_no: z.number(),
  odds_asian_handicap: z.number().optional(),
  odds_over_under_25: z.number().optional(),
  team_a_xg: z.number(),
  team_b_xg: z.number(),
  team_a_shots: z.number(),
  team_b_shots: z.number(),
  team_a_shotsOnTarget: z.number(),
  team_b_shotsOnTarget: z.number(),
  team_a_corners: z.number(),
  team_b_corners: z.number(),
  team_a_form: z.number().optional(),
  team_b_form: z.number().optional(),
});

export const FootyStatsMatchesResponseSchema = z.union([
  z.array(FootyStatsMatchSchema),
  z.object({
    success: z.boolean(),
    data: z.array(FootyStatsMatchSchema),
  }),
]);

export type FootyStatsMatch = z.infer<typeof FootyStatsMatchSchema>;

export class FootyStatsAPI {
  private apiKey: string;
  private baseUrl: string = 'https://api.football-data-api.com/api/v2';
  private maxRetries: number = 3;

  constructor() {
    this.apiKey = (process.env.FOOTYSTATS_API_KEY || '').trim();
  }

  private async fetchWithRetry(url: string, retries = 0): Promise<any> {
    if (!this.apiKey || this.apiKey === 'mock') {
      throw new Error('[FootyStatsAPI] FOOTYSTATS_API_KEY missing or invalid. Fail closed.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        if (retries < this.maxRetries) {
          const delay = Math.pow(2, retries) * 1000;
          await new Promise((res) => setTimeout(res, delay));
          return this.fetchWithRetry(url, retries + 1);
        }
        throw new Error('Rate limit exceeded');
      }

      if (!response.ok) {
        throw new Error(`FootyStats API Error: ${response.statusText}`);
      }

      const rawJson: unknown = await response.json();
      const validationResult = FootyStatsMatchesResponseSchema.safeParse(rawJson);
      
      if (!validationResult.success) {
        console.error('[FootyStatsAPI] Schema validation failed:', validationResult.error?.format());
        throw new Error(`FootyStats API response schema validation failed: ${validationResult.error?.message}`);
      }
      
      return validationResult.data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (retries < this.maxRetries) {
        await new Promise((res) => setTimeout(res, 1000));
        return this.fetchWithRetry(url, retries + 1);
      }
      console.error('Failed to fetch from FootyStats after retries', error);
      throw error;
    }
  }

  public async getMatchesForTomorrow(): Promise<FootyStatsMatch[]> {
    // In a real implementation, you'd pass date parameters
    const url = `${this.baseUrl}/matches?key=${this.apiKey}&date=tomorrow`;
    
    try {
      const result = await this.fetchWithRetry(url);
      if (this.apiKey === 'mock') return result as FootyStatsMatch[];
      
      if (result.success && result.data) {
        return result.data as FootyStatsMatch[];
      }
      return [];
    } catch (error) {
      console.error('Error in getMatchesForTomorrow:', error);
      return [];
    }
  }

  public async getMatchesForToday(): Promise<FootyStatsMatch[]> {
    const url = `${this.baseUrl}/matches?key=${this.apiKey}&date=today`;
    
    try {
      const result = await this.fetchWithRetry(url);
      if (this.apiKey === 'mock') return result as FootyStatsMatch[];
      
      if (result.success && result.data) {
        return result.data as FootyStatsMatch[];
      }
      return [];
    } catch (error) {
      console.error('Error in getMatchesForToday:', error);
      return [];
    }
  }
}

export const footyStatsApi = new FootyStatsAPI();
