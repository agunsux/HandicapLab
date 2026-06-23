import { getLeagueConfig } from './leagueRegistry';

export function getCohortTag(leagueId: number, matchStage?: string): string {
  const config = getLeagueConfig(leagueId);
  if (!config) {
    // Unknown league – safe fallback
    return 'GENERAL';
  }
  // Specific handling for World Cup
  if (config.cohort === 'WORLD_CUP') {
    const stage = (matchStage || '').toLowerCase();
    if (stage.includes('knockout') || stage.includes('quarter') || stage.includes('semi') || stage.includes('final')) {
      return 'WORLD_CUP_KO';
    }
    return 'WORLD_CUP_GROUP';
  }
  // Return the cohort defined for the league
  return config.cohort;
}
