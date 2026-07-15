import { CanonicalCompetition } from '../../domain/dataset/canonical';

export class CompetitionRegistry {
  public static readonly version = 'CompetitionRegistry v2';

  private static competitions: CanonicalCompetition[] = [
    { id: 'EPL', name: 'Premier League', country: 'England' },
    { id: 'FLC', name: 'Championship', country: 'England' },
    { id: 'SP1', name: 'La Liga', country: 'Spain' },
    { id: 'IT1', name: 'Serie A', country: 'Italy' },
    { id: 'GE1', name: 'Bundesliga', country: 'Germany' },
    { id: 'FR1', name: 'Ligue 1', country: 'France' }
  ];

  public static resolve(rawName: string): string {
    const clean = rawName.trim().toLowerCase();
    const match = this.competitions.find(c => 
      c.id.toLowerCase() === clean || 
      c.name.toLowerCase() === clean ||
      (clean.includes('premier') && c.id === 'EPL') ||
      (clean.includes('laliga') && c.id === 'SP1') ||
      (clean.includes('serie a') && c.id === 'IT1') ||
      (clean.includes('bundesliga') && c.id === 'GE1')
    );
    return match ? match.id : 'UNKNOWN';
  }

  public static getDetails(id: string): CanonicalCompetition | null {
    return this.competitions.find(c => c.id === id) || null;
  }

  public static listAll(): CanonicalCompetition[] {
    return this.competitions;
  }
}
