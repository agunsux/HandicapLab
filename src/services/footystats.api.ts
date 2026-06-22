export interface FootyStatsMatch {
  id: number;
  homeID: number;
  awayID: number;
  home_name: string;
  away_name: string;
  competition_name: string;
  date_unix: number; // Unix timestamp
  status: string;
  
  // Odds (pre-match)
  odds_ft_1: number;
  odds_ft_x: number;
  odds_ft_2: number;
  odds_btts_yes: number;
  odds_btts_no: number;
  odds_asian_handicap?: number; // Might need separate fetching, assuming it's here
  odds_over_under_25?: number; // Simplified assumption
  
  // Stats
  team_a_xg: number;
  team_b_xg: number;
  team_a_shots: number;
  team_b_shots: number;
  team_a_shotsOnTarget: number;
  team_b_shotsOnTarget: number;
  team_a_corners: number;
  team_b_corners: number;

  // Form
  team_a_form?: number; // Custom derivation or provided by API
  team_b_form?: number;
}

export class FootyStatsAPI {
  private apiKey: string;
  private baseUrl: string = 'https://api.football-data-api.com/api/v2';
  private maxRetries: number = 3;

  constructor() {
    this.apiKey = process.env.FOOTYSTATS_API_KEY || 'mock';
  }

  private async fetchWithRetry(url: string, retries = 0): Promise<any> {
    if (this.apiKey === 'mock') {
      return this.getMockMatches();
    }

    try {
      const response = await fetch(url);

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

      const data = await response.json();
      return data;
    } catch (error) {
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

  private getMockMatches(): FootyStatsMatch[] {
    const now = Math.floor(Date.now() / 1000);
    return [
      {
        id: 10001,
        homeID: 101,
        awayID: 102,
        home_name: 'Arsenal',
        away_name: 'Chelsea',
        competition_name: 'Premier League',
        date_unix: now + 86400,
        status: 'incomplete',
        odds_ft_1: 2.10,
        odds_ft_x: 3.40,
        odds_ft_2: 3.50,
        odds_btts_yes: 1.65,
        odds_btts_no: 2.15,
        odds_asian_handicap: -0.25,
        odds_over_under_25: 2.5,
        team_a_xg: 1.8,
        team_b_xg: 1.2,
        team_a_shots: 14,
        team_b_shots: 10,
        team_a_shotsOnTarget: 6,
        team_b_shotsOnTarget: 4,
        team_a_corners: 7,
        team_b_corners: 4,
        team_a_form: 4,
        team_b_form: 2
      },
      {
        id: 10002,
        homeID: 201,
        awayID: 202,
        home_name: 'Real Madrid',
        away_name: 'Barcelona',
        competition_name: 'La Liga',
        date_unix: now + 86400,
        status: 'incomplete',
        odds_ft_1: 2.30,
        odds_ft_x: 3.60,
        odds_ft_2: 2.80,
        odds_btts_yes: 1.50,
        odds_btts_no: 2.50,
        odds_asian_handicap: -0.25,
        odds_over_under_25: 3.5,
        team_a_xg: 2.1,
        team_b_xg: 1.9,
        team_a_shots: 16,
        team_b_shots: 15,
        team_a_shotsOnTarget: 7,
        team_b_shotsOnTarget: 6,
        team_a_corners: 6,
        team_b_corners: 5,
        team_a_form: 5,
        team_b_form: 4
      }
    ];
  }
}

export const footyStatsApi = new FootyStatsAPI();
