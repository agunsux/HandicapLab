// Team Name Normalizer for canonical name matching
// Location: src/lib/data/teamNormalizer.ts

export class TeamNormalizer {
  private static canonicalMap: Record<string, string> = {
    // Manchester United
    'man united': 'Manchester United',
    'manchester united': 'Manchester United',
    'manchester utd': 'Manchester United',
    'man utd': 'Manchester United',
    'manc united': 'Manchester United',
    'man. united': 'Manchester United',
    
    // Manchester City
    'man city': 'Manchester City',
    'manchester city': 'Manchester City',
    'manchester city fc': 'Manchester City',
    'manc city': 'Manchester City',
    'man. city': 'Manchester City',

    // Arsenal
    'arsenal fc': 'Arsenal',
    'arsenal': 'Arsenal',

    // Chelsea
    'chelsea fc': 'Chelsea',
    'chelsea': 'Chelsea',

    // Liverpool
    'liverpool fc': 'Liverpool',
    'liverpool': 'Liverpool',

    // Tottenham
    'tottenham hotspur': 'Tottenham Hotspur',
    'tottenham': 'Tottenham Hotspur',
    'spurs': 'Tottenham Hotspur',
    'tottenham hotspur fc': 'Tottenham Hotspur',

    // Aston Villa
    'aston villa': 'Aston Villa',
    'villa': 'Aston Villa',
    'aston villa fc': 'Aston Villa',

    // Newcastle United
    'newcastle united': 'Newcastle United',
    'newcastle': 'Newcastle United',
    'newcastle utd': 'Newcastle United',
    
    // Fulham
    'fulham': 'Fulham',
    'fulham fc': 'Fulham',

    // West Ham
    'west ham': 'West Ham United',
    'west ham united': 'West Ham United',
    'west ham utd': 'West Ham United',

    // Brighton
    'brighton': 'Brighton & Hove Albion',
    'brighton & hove albion': 'Brighton & Hove Albion',
    'brighton and hove albion': 'Brighton & Hove Albion',
    'brighton hove albion': 'Brighton & Hove Albion',

    // Everton
    'everton': 'Everton',
    'everton fc': 'Everton',

    // Crystal Palace
    'crystal palace': 'Crystal Palace',
    'crystal palace fc': 'Crystal Palace',

    // Brentford
    'brentford': 'Brentford',
    'brentford fc': 'Brentford',

    // Bournemouth
    'bournemouth': 'Bournemouth',
    'afc bournemouth': 'Bournemouth',

    // Nottingham Forest
    'nottingham forest': 'Nottingham Forest',
    'nottingham': 'Nottingham Forest',
    'forest': 'Nottingham Forest',

    // Wolverhampton
    'wolverhampton wanderers': 'Wolverhampton Wanderers',
    'wolves': 'Wolverhampton Wanderers',
    'wolverhampton': 'Wolverhampton Wanderers',

    // Ipswich
    'ipswich town': 'Ipswich Town',
    'ipswich': 'Ipswich Town',

    // Leicester
    'leicester city': 'Leicester City',
    'leicester': 'Leicester City',

    // Southampton
    'southampton': 'Southampton',
    'southampton fc': 'Southampton'
  };

  /**
   * Normalize a team name to its canonical string representation.
   */
  public static normalize(name: string): string {
    if (!name) return '';
    const cleaned = name.trim().toLowerCase();
    
    // Check direct dictionary mapping
    if (this.canonicalMap[cleaned]) {
      return this.canonicalMap[cleaned];
    }
    
    // Fuzzy cleanses
    let matchedName = name.trim();
    
    // Strip FC, Utd, City suffixes to try fallback matching
    let stripped = cleaned
      .replace(/\s+fc$/, '')
      .replace(/\s+utd$/, ' united')
      .replace(/\s+united$/, '')
      .replace(/\s+city$/, '')
      .trim();

    if (this.canonicalMap[stripped]) {
      return this.canonicalMap[stripped];
    }

    // Capitalize words as a baseline fallback
    return matchedName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Compare two team names for equivalence.
   */
  public static areEquivalent(name1: string, name2: string): boolean {
    return this.normalize(name1) === this.normalize(name2);
  }
}
