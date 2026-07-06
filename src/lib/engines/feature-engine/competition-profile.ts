import { LEAGUE_REGISTRY } from '../../crons/leagueRegistry';

export interface CompetitionProfile {
  type: 'club' | 'international';
  goalEnvironment: number; // mapped average goals, e.g. 2.5
  homeAdvantageModifier: number; // home advantage value, e.g. 1.12
  variance: number; // mapped variance, e.g. 1.15
  restSensitivity: number; // fatigue multiplier
  pressureFactor: number; // tournament stage pressure
  marketLiquidity: 'high' | 'medium' | 'low';
  goalEnvironmentConfig: string;
  varianceConfig: string;
  plattA?: number;
  plattB?: number;
}

export class CompetitionProfileEngine {
  /**
   * Backward-compatible helper for old tests.
   */
  public static getProfile(type: 'club' | 'international'): CompetitionProfile {
    if (type === 'international') {
      return {
        type: 'international',
        goalEnvironment: 2.45,
        homeAdvantageModifier: 1.02,
        variance: 1.30,
        restSensitivity: 1.3,
        pressureFactor: 1.2,
        marketLiquidity: 'high',
        goalEnvironmentConfig: 'medium-low',
        varianceConfig: 'high'
      };
    }
    return {
      type: 'club',
      goalEnvironment: 2.5,
      homeAdvantageModifier: 1.12,
      variance: 1.15,
      restSensitivity: 1.0,
      pressureFactor: 0.5,
      marketLiquidity: 'high',
      goalEnvironmentConfig: 'medium',
      varianceConfig: 'medium'
    };
  }

  /**
   * Retrieves mapped competition profile by league ID, Name, or apiFootballId.
   */
  public static getProfileForLeague(leagueIdOrName: string): CompetitionProfile {
    const nameLower = (leagueIdOrName || '').toLowerCase();
    const config = LEAGUE_REGISTRY.find(
      l => l.id.toLowerCase() === nameLower || 
           l.name.toLowerCase() === nameLower ||
           l.apiFootballId.toString() === leagueIdOrName
    );

    if (!config) {
      // Fallback based on name/stage
      const isInt = nameLower.includes('world cup') || nameLower.includes('international');
      return this.getProfile(isInt ? 'international' : 'club');
    }

    // Map goalEnvironment string to base goals
    let goalEnvVal = 2.5;
    if (config.profile.goalEnvironment === 'high') goalEnvVal = 2.85;
    else if (config.profile.goalEnvironment === 'medium-high') goalEnvVal = 2.70;
    else if (config.profile.goalEnvironment === 'medium') goalEnvVal = 2.55;
    else if (config.profile.goalEnvironment === 'medium-low') goalEnvVal = 2.40;
    else if (config.profile.goalEnvironment === 'low') goalEnvVal = 2.25;

    // Map variance string to numeric variance
    let varVal = 1.15;
    if (config.profile.variance === 'high') varVal = 1.30;
    else if (config.profile.variance === 'medium-high') varVal = 1.22;
    else if (config.profile.variance === 'medium') varVal = 1.15;
    else if (config.profile.variance === 'low') varVal = 1.05;

    return {
      type: config.type,
      goalEnvironment: goalEnvVal,
      homeAdvantageModifier: config.profile.homeAdvantage,
      variance: varVal,
      restSensitivity: config.profile.fatigueSensitivity,
      pressureFactor: config.type === 'international' ? 1.2 : 0.5,
      marketLiquidity: config.profile.marketLiquidity,
      goalEnvironmentConfig: config.profile.goalEnvironment,
      varianceConfig: config.profile.variance,
      plattA: (config.profile as any).plattA,
      plattB: (config.profile as any).plattB
    };
  }
}
