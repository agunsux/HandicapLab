import { getLeagueConfig, LeagueConfig } from '../crons/leagueRegistry';

export type LeagueCohort = 'elite_europe' | 'europe_qualification' | 'latin_america' | 'asia' | 'other';

export class CohortSelector {
  /**
   * Resolves the league cohort category based on the league name/country.
   */
  public static resolve(leagueNameOrId: string | number): LeagueCohort {
    const config = getLeagueConfig(leagueNameOrId);
    if (!config) {
      return this.resolveByText(String(leagueNameOrId));
    }
    return this.resolveFromConfig(config);
  }

  private static resolveFromConfig(config: LeagueConfig): LeagueCohort {
    const name = config.name.toLowerCase();
    const country = config.country.toLowerCase();

    // 1. Europe Qualification
    if (name.includes('qualification') || name.includes('qualifying')) {
      return 'europe_qualification';
    }

    // 2. Elite Europe
    const eliteNames = ['premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1'];
    if (eliteNames.includes(name) || eliteNames.includes(config.id)) {
      return 'elite_europe';
    }

    // 3. Latin America
    const latamCountries = ['brazil', 'argentina', 'chile', 'colombia', 'ecuador', 'uruguay', 'paraguay', 'peru'];
    if (latamCountries.includes(country)) {
      return 'latin_america';
    }

    // 4. Asia
    const asiaCountries = ['japan', 'south korea', 'china', 'saudi arabia', 'uae', 'qatar', 'thailand', 'indonesia'];
    if (asiaCountries.includes(country)) {
      return 'asia';
    }

    return 'other';
  }

  private static resolveByText(text: string): LeagueCohort {
    const lower = text.toLowerCase();
    
    if (lower.includes('qualification') || lower.includes('qualifying')) {
      return 'europe_qualification';
    }

    const eliteNames = ['premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1'];
    if (eliteNames.some(e => lower.includes(e))) {
      return 'elite_europe';
    }

    const latamKeywords = ['brazil', 'argentina', 'chile', 'colombia', 'ecuador', 'uruguay', 'paraguay', 'peru', 'liga pro', 'primera division', 'primera a'];
    if (latamKeywords.some(k => lower.includes(k))) {
      return 'latin_america';
    }

    const asiaKeywords = ['japan', 'k league', 'china', 'saudi', 'uae', 'qatar', 'thailand', 'indonesia', 'stars league', 'j1 league', 'super league'];
    if (asiaKeywords.some(k => lower.includes(k))) {
      return 'asia';
    }

    return 'other';
  }
}
