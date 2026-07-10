import { CanonicalCompetition, CanonicalSeason } from './types';

const DEFAULT_COMPETITIONS: CanonicalCompetition[] = [
  { id: 'comp:epl', name: 'English Premier League', shortName: 'EPL', country: 'England', tier: 1, timezone: 'Europe/London', sport: 'football' },
  { id: 'comp:laliga', name: 'La Liga', shortName: 'La Liga', country: 'Spain', tier: 1, timezone: 'Europe/Madrid', sport: 'football' },
  { id: 'comp:bundesliga', name: 'Bundesliga', shortName: 'Bundesliga', country: 'Germany', tier: 1, timezone: 'Europe/Berlin', sport: 'football' },
  { id: 'comp:seriea', name: 'Serie A', shortName: 'Serie A', country: 'Italy', tier: 1, timezone: 'Europe/Rome', sport: 'football' },
  { id: 'comp:ligue1', name: 'Ligue 1', shortName: 'Ligue 1', country: 'France', tier: 1, timezone: 'Europe/Paris', sport: 'football' },
  { id: 'comp:ucl', name: 'UEFA Champions League', shortName: 'UCL', country: 'Europe', tier: 1, timezone: 'Europe/Zurich', sport: 'football' },
  { id: 'comp:uel', name: 'UEFA Europa League', shortName: 'UEL', country: 'Europe', tier: 2, timezone: 'Europe/Zurich', sport: 'football' },
  { id: 'comp:wc', name: 'FIFA World Cup', shortName: 'World Cup', country: 'World', tier: 1, timezone: 'UTC', sport: 'football' },
];

export class CompetitionRegistry {
  private competitions: Map<string, CanonicalCompetition> = new Map();
  private nameIndex: Map<string, string> = new Map();

  constructor(competitions: CanonicalCompetition[] = DEFAULT_COMPETITIONS) {
    for (const comp of competitions) {
      this.competitions.set(comp.id, comp);
      this.nameIndex.set(comp.name.toLowerCase(), comp.id);
      this.nameIndex.set(comp.shortName.toLowerCase(), comp.id);
    }
  }

  resolve(value: string): CanonicalCompetition | null {
    const clean = value.toLowerCase().trim();
    const id = this.competitions.has(clean) ? clean : this.nameIndex.get(clean);
    return id ? this.competitions.get(id) || null : null;
  }

  getSeasons(competitionId: string, startYear: number, endYear: number): CanonicalSeason[] {
    const seasons: CanonicalSeason[] = [];
    for (let year = startYear; year < endYear; year++) {
      const name = `${year}-${year + 1}`;
      seasons.push({
        id: `season:${competitionId.replace('comp:', '')}:${name}`,
        competitionId,
        name,
        startDate: `${year}-08-01T00:00:00Z`,
        endDate: `${year + 1}-05-31T23:59:59Z`,
      });
    }
    return seasons;
  }

  getCompetition(id: string): CanonicalCompetition | undefined {
    return this.competitions.get(id);
  }

  getAllCompetitions(): CanonicalCompetition[] {
    return Array.from(this.competitions.values());
  }

  addCompetition(comp: CanonicalCompetition): void {
    this.competitions.set(comp.id, comp);
    this.nameIndex.set(comp.name.toLowerCase(), comp.id);
    this.nameIndex.set(comp.shortName.toLowerCase(), comp.id);
  }
}

export const defaultCompetitionRegistry = new CompetitionRegistry();