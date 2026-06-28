import { getLeagueConfig } from './leagueRegistry';
import { normalizeTournamentStage } from '../utils/stageNormalization';

export function getCohortTag(leagueId: number | string, matchStage?: string): string {
  const config = getLeagueConfig(leagueId);
  if (!config) {
    // Unknown league – safe fallback
    return 'GENERAL';
  }
  // Specific handling for World Cup
  if (config.cohort === 'WORLD_CUP') {
    const normStage = normalizeTournamentStage(matchStage);
    const koStages = ['Playoffs', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];
    if (koStages.includes(normStage) || normStage.toLowerCase().includes('knockout') || normStage.toLowerCase().includes('ko')) {
      return 'WORLD_CUP_KO';
    }
    return 'WORLD_CUP_GROUP';
  }
  // Return the cohort defined for the league
  return config.cohort;
}
