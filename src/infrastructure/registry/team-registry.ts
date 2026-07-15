import { CanonicalTeam } from '../../domain/dataset/canonical';

export class TeamRegistry {
  public static readonly version = 'TeamRegistry v3';
  
  private static canonicalTeams: CanonicalTeam[] = [
    { id: 'arsenal', name: 'Arsenal', aliases: ['Arsenal', 'Arsenal FC'] },
    { id: 'astonvilla', name: 'Aston Villa', aliases: ['Aston Villa', 'Aston Villa FC'] },
    { id: 'chelsea', name: 'Chelsea', aliases: ['Chelsea', 'Chelsea FC'] },
    { id: 'liverpool', name: 'Liverpool', aliases: ['Liverpool', 'Liverpool FC'] },
    { id: 'manchestercity', name: 'Manchester City', aliases: ['Man City', 'Manchester City', 'Manchester City FC', 'Man City FC'] },
    { id: 'manchesterunited', name: 'Manchester United', aliases: ['Man Utd', 'Manchester United', 'Man United', 'Manchester United FC', 'Man Utd FC', 'Manchester Utd', 'Manchester Utd FC'] },
    { id: 'tottenham', name: 'Tottenham', aliases: ['Tottenham Hotspur', 'Spurs', 'Tottenham', 'Tottenham FC'] },
    { id: 'leicester', name: 'Leicester', aliases: ['Leicester City', 'Leicester'] },
    { id: 'everton', name: 'Everton', aliases: ['Everton FC', 'Everton'] },
    { id: 'newcastle', name: 'Newcastle', aliases: ['Newcastle United', 'Newcastle', 'Newcastle Utd'] },
    { id: 'westham', name: 'West Ham', aliases: ['West Ham United', 'West Ham', 'West Ham Utd'] },
    { id: 'crystalpalace', name: 'Crystal Palace', aliases: ['Crystal Palace FC', 'Crystal Palace'] },
    { id: 'southampton', name: 'Southampton', aliases: ['Southampton FC', 'Southampton'] },
    { id: 'wolves', name: 'Wolves', aliases: ['Wolverhampton Wanderers', 'Wolves', 'Wolverhampton'] },
    { id: 'leeds', name: 'Leeds', aliases: ['Leeds United', 'Leeds', 'Leeds Utd'] },
    { id: 'burnley', name: 'Burnley', aliases: ['Burnley FC', 'Burnley'] },
    { id: 'watford', name: 'Watford', aliases: ['Watford FC', 'Watford'] },
    { id: 'norwich', name: 'Norwich', aliases: ['Norwich City', 'Norwich'] },
    { id: 'bournemouth', name: 'Bournemouth', aliases: ['AFC Bournemouth', 'Bournemouth'] },
    { id: 'brighton', name: 'Brighton', aliases: ['Brighton & Hove Albion', 'Brighton', 'Brighton Albion'] },
    { id: 'fulham', name: 'Fulham', aliases: ['Fulham FC', 'Fulham'] },
    { id: 'sheffieldunited', name: 'Sheffield United', aliases: ['Sheffield Utd', 'Sheffield United', 'Sheffield Utd FC'] },
    { id: 'brentford', name: 'Brentford', aliases: ['Brentford FC', 'Brentford'] },
    { id: 'nottinghamforest', name: 'Nottingham Forest', aliases: ['Nottingham Forest FC', 'Nottingham Forest', 'Nottingham'] },
    { id: 'luton', name: 'Luton', aliases: ['Luton Town', 'Luton'] },
    { id: 'middlesbrough', name: 'Middlesbrough', aliases: ['Middlesbrough FC', 'Middlesbrough'] },
    { id: 'sunderland', name: 'Sunderland', aliases: ['Sunderland AFC', 'Sunderland'] },
    { id: 'hull', name: 'Hull', aliases: ['Hull City', 'Hull'] },
    { id: 'swansea', name: 'Swansea', aliases: ['Swansea City', 'Swansea'] },
    { id: 'westbrom', name: 'West Brom', aliases: ['West Bromwich Albion', 'West Brom', 'West Bromwich'] },
    { id: 'stoke', name: 'Stoke', aliases: ['Stoke City', 'Stoke'] },
    { id: 'ipswich', name: 'Ipswich', aliases: ['Ipswich Town', 'Ipswich'] }
  ];

  /**
   * Resolves a raw string name to a canonical team ID.
   */
  public static resolve(rawName: string): string {
    const clean = rawName.trim().toLowerCase();
    
    // Exact matches
    const exact = this.canonicalTeams.find(t => t.id === clean || t.name.toLowerCase() === clean);
    if (exact) return exact.id;

    // Alias matches
    const aliasMatch = this.canonicalTeams.find(t => 
      t.aliases.some(alias => alias.toLowerCase() === clean)
    );
    if (aliasMatch) return aliasMatch.id;

    // Substring fallback
    const substringMatch = this.canonicalTeams.find(t => 
      clean.includes(t.id) || t.id.includes(clean)
    );
    if (substringMatch) return substringMatch.id;

    // Fallback: generate a slug
    return clean.replace(/[^a-z0-9]/g, '');
  }

  public static getCanonicalName(id: string): string {
    const match = this.canonicalTeams.find(t => t.id === id);
    return match ? match.name : id.charAt(0).toUpperCase() + id.slice(1);
  }

  public static listAll(): CanonicalTeam[] {
    return this.canonicalTeams;
  }
}
