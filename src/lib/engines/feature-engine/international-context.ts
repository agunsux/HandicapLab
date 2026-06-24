export interface InternationalContext {
  fifaRankingHome: number;
  fifaRankingAway: number;
  squadContinuityHome: number;
  squadContinuityAway: number;
  knockoutPressure: number;
  internationalAdjustmentScore: number;
}

export class InternationalContextExtractor {
  /**
   * Evaluates international tournament parameters and calculates the adjustment score.
   * Incorporates: squad familiarity, travel distance, days between matches, rotation probability, and tournament pressure.
   */
  public static extract(matchData: any, fatigueData: any): InternationalContext {
    const fifaRankingHome = matchData.fifa_ranking_home ? Number(matchData.fifa_ranking_home) : 50;
    const fifaRankingAway = matchData.fifa_ranking_away ? Number(matchData.fifa_ranking_away) : 50;

    // Squad continuity: standard continuity/strength factor
    const squadContinuityHome = matchData.squad_strength_home ? Number(matchData.squad_strength_home) : 0.75;
    const squadContinuityAway = matchData.squad_strength_away ? Number(matchData.squad_strength_away) : 0.75;

    // Determine tournament stage and knockout pressure
    const stage = (matchData.tournament_stage || '').toLowerCase();
    let knockoutPressure = 0.3; // Default group stage / friendly pressure
    if (stage.includes('knockout') || stage.includes('round of') || stage.includes('ko') || stage.includes('1/8') || stage.includes('1/16')) {
      knockoutPressure = 0.6;
    }
    if (stage.includes('quarter') || stage.includes('1/4')) {
      knockoutPressure = 0.8;
    }
    if (stage.includes('semi') || stage.includes('1/2')) {
      knockoutPressure = 0.9;
    }
    if (stage.includes('final') && !stage.includes('semi') && !stage.includes('quarter')) {
      knockoutPressure = 1.0;
    }

    // 1. Squad familiarity (continuity)
    const avgContinuity = (squadContinuityHome + squadContinuityAway) / 2;

    // 2. Travel distance impact (normalized to 5000km max)
    const homeTravel = fatigueData.homeTravelKm || 0;
    const travelFactor = Math.min(1.0, homeTravel / 5000);

    // 3. Days between matches (rest sensitivity)
    const restDaysMin = Math.min(fatigueData.homeRestDays || 7, fatigueData.awayRestDays || 7);
    const restFactor = restDaysMin >= 4 ? 1.0 : restDaysMin / 4;

    // 4. Rotation probability (fatigue-driven rotation)
    const rotationProb = restDaysMin < 4 ? 0.35 : 0.10;

    // 5. Tournament pressure
    const pressureFactor = knockoutPressure;

    // Calculate adjustment score
    // Base 1.0. High continuity/rest boosts coordination; high travel, rotation, and knockout pressure depress scoring pace
    const internationalAdjustmentScore = Number(
      (1.0 + (avgContinuity * 0.1) + (restFactor * 0.05) - (travelFactor * 0.08) - (rotationProb * 0.05) - (pressureFactor * 0.05)).toFixed(4)
    );

    return {
      fifaRankingHome,
      fifaRankingAway,
      squadContinuityHome,
      squadContinuityAway,
      knockoutPressure,
      internationalAdjustmentScore
    };
  }
}
