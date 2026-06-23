export function getCohortTag(leagueId: number, matchStage?: string): string {
  // World Cup league ID assumed to be 1
  if (leagueId === 1) {
    const stage = (matchStage || '').toLowerCase();
    if (stage.includes('knockout') || stage.includes('quarter') || stage.includes('semi') || stage.includes('final')) {
      return 'WORLD_CUP_KO';
    }
    return 'WORLD_CUP_GROUP';
  }
  // Default general cohort
  return 'GENERAL';
}
