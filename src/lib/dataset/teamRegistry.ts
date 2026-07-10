/**
 * HandicapLab Team Identity Registry
 * ====================================
 * Canonical team identities with alias resolution.
 *
 * Every external team name (e.g. "Man United", "Manchester Utd")
 * resolves to a single canonical ID.
 */

import { CanonicalTeam } from './types';

const CANONICAL_TEAMS: CanonicalTeam[] = [
  { id: 'team:epl:liverpool', name: 'Liverpool', shortName: 'LIV', country: 'England', aliases: ['Liverpool FC', 'LFC', 'Pool'] },
  { id: 'team:epl:manchester-city', name: 'Manchester City', shortName: 'MCI', country: 'England', aliases: ['Man City', 'Man City', 'City', 'MCFC'] },
  { id: 'team:epl:arsenal', name: 'Arsenal', shortName: 'ARS', country: 'England', aliases: ['Arsenal FC', 'The Gunners', 'AFC'] },
  { id: 'team:epl:chelsea', name: 'Chelsea', shortName: 'CHE', country: 'England', aliases: ['Chelsea FC', 'CFC', 'The Blues'] },
  { id: 'team:epl:manchester-united', name: 'Manchester United', shortName: 'MUN', country: 'England', aliases: ['Man United', 'Man Utd', 'MUFC', 'Man U', 'Manchester Utd'] },
  { id: 'team:epl:tottenham', name: 'Tottenham Hotspur', shortName: 'TOT', country: 'England', aliases: ['Tottenham', 'Spurs', 'THFC'] },
  { id: 'team:epl:newcastle', name: 'Newcastle United', shortName: 'NEW', country: 'England', aliases: ['Newcastle', 'NUFC', 'The Magpies'] },
  { id: 'team:epl:aston-villa', name: 'Aston Villa', shortName: 'AVL', country: 'England', aliases: ['Aston Villa FC', 'Villa', 'AVFC'] },
  { id: 'team:epl:brighton', name: 'Brighton & Hove Albion', shortName: 'BRI', country: 'England', aliases: ['Brighton', 'BHAFC', 'The Seagulls'] },
  { id: 'team:epl:wolves', name: 'Wolverhampton Wanderers', shortName: 'WOL', country: 'England', aliases: ['Wolves', 'Wolverhampton', 'WWFC'] },
  { id: 'team:epl:fulham', name: 'Fulham', shortName: 'FUL', country: 'England', aliases: ['Fulham FC', 'FFC', 'The Cottagers'] },
  { id: 'team:epl:leicester', name: 'Leicester City', shortName: 'LEI', country: 'England', aliases: ['Leicester', 'LCFC', 'The Foxes'] },
  { id: 'team:epl:west-ham', name: 'West Ham United', shortName: 'WHU', country: 'England', aliases: ['West Ham', 'WHUFC', 'The Hammers'] },
  { id: 'team:epl:everton', name: 'Everton', shortName: 'EVE', country: 'England', aliases: ['Everton FC', 'EFC', 'The Toffees'] },
  // La Liga
  { id: 'team:laliga:barcelona', name: 'Barcelona', shortName: 'BAR', country: 'Spain', aliases: ['FC Barcelona', 'Barca', 'Barça'] },
  { id: 'team:laliga:real-madrid', name: 'Real Madrid', shortName: 'RMA', country: 'Spain', aliases: ['Real Madrid CF', 'Madrid', 'Los Blancos', 'Real'] },
  // Bundesliga
  { id: 'team:buli:bayern-munich', name: 'Bayern Munich', shortName: 'BAY', country: 'Germany', aliases: ['FC Bayern', 'Bayern München', 'FCB'] },
  // Seria A
  { id: 'team:seriea:juventus', name: 'Juventus', shortName: 'JUV', country: 'Italy', aliases: ['Juventus FC', 'Juve'] },
  { id: 'team:seriea:ac-milan', name: 'AC Milan', shortName: 'ACM', country: 'Italy', aliases: ['Milan', 'AC Milan'] },
  { id: 'team:seriea:inter-milan', name: 'Inter Milan', shortName: 'INT', country: 'Italy', aliases: ['Inter', 'FC Internazionale'] },
  // Ligue 1
  { id: 'team:ligue1:psg', name: 'Paris Saint-Germain', shortName: 'PSG', country: 'France', aliases: ['PSG', 'Paris SG', 'Paris Saint Germain'] },
  { id: 'team:ligue1:lyon', name: 'Olympique Lyonnais', shortName: 'LYO', country: 'France', aliases: ['Lyon', 'Olympique Lyon'] },
  { id: 'team:ligue1:marseille', name: 'Olympique de Marseille', shortName: 'MAR', country: 'France', aliases: ['Marseille', 'OM'] },
];

export class TeamIdentityRegistry {
  private teams: Map<string, CanonicalTeam> = new Map();
  private aliasIndex: Map<string, string> = new Map(); // alias → team id

  constructor(teams: CanonicalTeam[] = CANONICAL_TEAMS) {
    for (const team of teams) {
      this.teams.set(team.id, team);
      this.aliasIndex.set(team.name.toLowerCase(), team.id);
      this.aliasIndex.set(team.shortName.toLowerCase(), team.id);
      for (const alias of team.aliases) {
        this.aliasIndex.set(alias.toLowerCase(), team.id);
      }
    }
  }

  resolve(name: string): CanonicalTeam | null {
    const clean = name.toLowerCase().trim();
    // Direct lookup
    const id = this.aliasIndex.get(clean);
    if (id) return this.teams.get(id) || null;
    // Fuzzy: check if any alias contains the name or vice versa
    for (const [alias, teamId] of this.aliasIndex) {
      if (alias.includes(clean) || clean.includes(alias)) {
        return this.teams.get(teamId) || null;
      }
    }
    return null;
  }

  resolveId(name: string): string | null {
    const team = this.resolve(name);
    return team ? team.id : null;
  }

  getTeam(id: string): CanonicalTeam | undefined {
    return this.teams.get(id);
  }

  getAllTeams(): CanonicalTeam[] {
    return Array.from(this.teams.values());
  }

  addTeam(team: CanonicalTeam): void {
    this.teams.set(team.id, team);
    this.aliasIndex.set(team.name.toLowerCase(), team.id);
    this.aliasIndex.set(team.shortName.toLowerCase(), team.id);
    for (const alias of team.aliases) {
      this.aliasIndex.set(alias.toLowerCase(), team.id);
    }
  }
}

export const defaultTeamRegistry = new TeamIdentityRegistry();