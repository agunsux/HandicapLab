/**
 * Shared utility for normalizing soccer tournament stages.
 * Consistently maps various provider round representations to a clean internal knockout/stage representation.
 */
export function normalizeTournamentStage(stage: string | null | undefined): string {
  if (!stage) return 'Group Stage';
  const clean = stage.toLowerCase().trim();

  // Play Offs / Playoffs
  if (clean.includes('playoff') || clean.includes('play off') || clean.includes('play-off')) {
    return 'Playoffs';
  }
  
  // Round of 32 / 1/16
  if (clean.includes('1/16') || clean.includes('32')) {
    return 'Round of 32';
  }

  // Round of 16 / 1/8
  if (clean.includes('1/8') || clean.includes('16') || clean.includes('octavos')) {
    return 'Round of 16';
  }

  // Quarter Finals / 1/4
  if (clean.includes('1/4') || clean.includes('quarter') || clean.includes('cuartos')) {
    return 'Quarter-finals';
  }

  // Semi Finals / 1/2
  if (clean.includes('1/2') || clean.includes('semi')) {
    return 'Semi-finals';
  }

  // Final
  if (clean.includes('final') && !clean.includes('semi') && !clean.includes('quarter') && !clean.includes('1/16') && !clean.includes('1/8') && !clean.includes('1/4') && !clean.includes('1/2')) {
    return 'Final';
  }

  // Group Stage
  if (clean.includes('group') || clean.includes('round robin') || clean.includes('grupo')) {
    return 'Group Stage';
  }

  return stage; // fallback to original string
}
