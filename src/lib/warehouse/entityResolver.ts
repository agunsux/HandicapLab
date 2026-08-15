import crypto from 'crypto';

export interface CanonicalTeam {
  id: string;
  canonicalName: string;
  shortName: string;
  countryCode: string;
  primaryCompetitionCode: string;
}

export interface TeamAliasRecord {
  teamId: string;
  providerId: string;
  providerTeamName: string;
  confidence: number;
}

// Built-in canonical dictionary for Premier League & Top Tier Leagues
export const CANONICAL_TEAMS_SEED: CanonicalTeam[] = [
  { id: 'tm-epl-001', canonicalName: 'Manchester City FC', shortName: 'Man City', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-002', canonicalName: 'Arsenal FC', shortName: 'Arsenal', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-003', canonicalName: 'Liverpool FC', shortName: 'Liverpool', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-004', canonicalName: 'Aston Villa FC', shortName: 'Aston Villa', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-005', canonicalName: 'Tottenham Hotspur FC', shortName: 'Tottenham', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-006', canonicalName: 'Chelsea FC', shortName: 'Chelsea', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-007', canonicalName: 'Newcastle United FC', shortName: 'Newcastle', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-008', canonicalName: 'Manchester United FC', shortName: 'Man Utd', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-009', canonicalName: 'West Ham United FC', shortName: 'West Ham', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-010', canonicalName: 'Crystal Palace FC', shortName: 'Crystal Palace', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-011', canonicalName: 'Brighton & Hove Albion FC', shortName: 'Brighton', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-012', canonicalName: 'Everton FC', shortName: 'Everton', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-013', canonicalName: 'AFC Bournemouth', shortName: 'Bournemouth', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-014', canonicalName: 'Fulham FC', shortName: 'Fulham', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-015', canonicalName: 'Wolverhampton Wanderers FC', shortName: 'Wolves', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-016', canonicalName: 'Brentford FC', shortName: 'Brentford', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-017', canonicalName: 'Nottingham Forest FC', shortName: 'Nottm Forest', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-018', canonicalName: 'Luton Town FC', shortName: 'Luton', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-019', canonicalName: 'Burnley FC', shortName: 'Burnley', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-020', canonicalName: 'Sheffield United FC', shortName: 'Sheffield Utd', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-021', canonicalName: 'Southampton FC', shortName: 'Southampton', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-022', canonicalName: 'Leicester City FC', shortName: 'Leicester', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  { id: 'tm-epl-023', canonicalName: 'Ipswich Town FC', shortName: 'Ipswich', countryCode: 'GB', primaryCompetitionCode: 'EPL' },
  // La Liga
  { id: 'tm-laliga-001', canonicalName: 'Real Madrid CF', shortName: 'Real Madrid', countryCode: 'ES', primaryCompetitionCode: 'LALIGA' },
  { id: 'tm-laliga-002', canonicalName: 'FC Barcelona', shortName: 'Barcelona', countryCode: 'ES', primaryCompetitionCode: 'LALIGA' },
  { id: 'tm-laliga-003', canonicalName: 'Club Atlético de Madrid', shortName: 'Atletico Madrid', countryCode: 'ES', primaryCompetitionCode: 'LALIGA' },
  { id: 'tm-laliga-004', canonicalName: 'Sevilla FC', shortName: 'Sevilla', countryCode: 'ES', primaryCompetitionCode: 'LALIGA' },
  { id: 'tm-laliga-005', canonicalName: 'Real Betis Balompié', shortName: 'Real Betis', countryCode: 'ES', primaryCompetitionCode: 'LALIGA' },
  { id: 'tm-laliga-006', canonicalName: 'Valencia CF', shortName: 'Valencia', countryCode: 'ES', primaryCompetitionCode: 'LALIGA' },
  // Serie A
  { id: 'tm-seriea-001', canonicalName: 'FC Internazionale Milano', shortName: 'Inter', countryCode: 'IT', primaryCompetitionCode: 'SERIEA' },
  { id: 'tm-seriea-002', canonicalName: 'Juventus FC', shortName: 'Juventus', countryCode: 'IT', primaryCompetitionCode: 'SERIEA' },
  { id: 'tm-seriea-003', canonicalName: 'AC Milan', shortName: 'Milan', countryCode: 'IT', primaryCompetitionCode: 'SERIEA' },
  { id: 'tm-seriea-004', canonicalName: 'AS Roma', shortName: 'Roma', countryCode: 'IT', primaryCompetitionCode: 'SERIEA' },
  { id: 'tm-seriea-005', canonicalName: 'SSC Napoli', shortName: 'Napoli', countryCode: 'IT', primaryCompetitionCode: 'SERIEA' },
  // Bundesliga
  { id: 'tm-bundesliga-001', canonicalName: 'FC Bayern München', shortName: 'Bayern Munich', countryCode: 'DE', primaryCompetitionCode: 'BUNDESLIGA' },
  { id: 'tm-bundesliga-002', canonicalName: 'Borussia Dortmund', shortName: 'Dortmund', countryCode: 'DE', primaryCompetitionCode: 'BUNDESLIGA' },
  { id: 'tm-bundesliga-003', canonicalName: 'Bayer 04 Leverkusen', shortName: 'Leverkusen', countryCode: 'DE', primaryCompetitionCode: 'BUNDESLIGA' },
  { id: 'tm-bundesliga-004', canonicalName: 'RB Leipzig', shortName: 'RB Leipzig', countryCode: 'DE', primaryCompetitionCode: 'BUNDESLIGA' },
];

export class CanonicalEntityResolver {
  private aliasMap: Map<string, string> = new Map();
  private teamCatalog: Map<string, CanonicalTeam> = new Map();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    CANONICAL_TEAMS_SEED.forEach((t) => {
      this.teamCatalog.set(t.id, t);
      // Self mapping for canonical name and short name
      this.registerAlias(t.id, 'canonical', t.canonicalName);
      this.registerAlias(t.id, 'canonical', t.shortName);
    });

    // Seed common provider variations
    const mappings: [string, string, string][] = [
      // [Canonical ID, Provider ID, Raw Provider Team Name]
      ['tm-epl-001', 'football_data', 'Man City'],
      ['tm-epl-001', 'understat', 'Manchester City'],
      ['tm-epl-001', 'club_elo', 'Manchester City FC'],
      ['tm-epl-001', 'api_football', 'Manchester City'],
      ['tm-epl-001', 'oddspapi', 'Manchester City'],
      ['tm-epl-002', 'football_data', 'Arsenal'],
      ['tm-epl-002', 'understat', 'Arsenal'],
      ['tm-epl-002', 'club_elo', 'Arsenal FC'],
      ['tm-epl-002', 'api_football', 'Arsenal'],
      ['tm-epl-002', 'oddspapi', 'Arsenal'],
      ['tm-epl-003', 'football_data', 'Liverpool'],
      ['tm-epl-003', 'understat', 'Liverpool'],
      ['tm-epl-003', 'club_elo', 'Liverpool FC'],
      ['tm-epl-003', 'api_football', 'Liverpool'],
      ['tm-epl-003', 'oddspapi', 'Liverpool'],
      ['tm-epl-006', 'api_football', 'Chelsea'],
      ['tm-epl-006', 'oddspapi', 'Chelsea'],
      ['tm-epl-005', 'api_football', 'Tottenham'],
      ['tm-epl-005', 'oddspapi', 'Tottenham'],
      ['tm-epl-008', 'football_data', 'Man United'],
      ['tm-epl-008', 'understat', 'Manchester United'],
      ['tm-epl-008', 'club_elo', 'Manchester United FC'],
      ['tm-epl-008', 'api_football', 'Manchester United'],
      ['tm-epl-008', 'oddspapi', 'Manchester United'],
      ['tm-epl-015', 'football_data', 'Wolves'],
      ['tm-epl-015', 'understat', 'Wolverhampton Wanderers'],
      ['tm-epl-017', 'football_data', "Nott'm Forest"],
      ['tm-epl-017', 'understat', 'Nottingham Forest'],
      ['tm-epl-020', 'football_data', 'Sheffield United'],
      ['tm-epl-020', 'understat', 'Sheffield United'],
      // La Liga
      ['tm-laliga-001', 'api_football', 'Real Madrid'],
      ['tm-laliga-001', 'oddspapi', 'Real Madrid'],
      ['tm-laliga-002', 'api_football', 'Barcelona'],
      ['tm-laliga-002', 'oddspapi', 'Barcelona'],
      ['tm-laliga-002', 'oddspapi', 'FC Barcelona'],
      ['tm-laliga-003', 'api_football', 'Atletico Madrid'],
      ['tm-laliga-003', 'oddspapi', 'Atletico Madrid'],
      ['tm-laliga-004', 'api_football', 'Sevilla'],
      ['tm-laliga-004', 'oddspapi', 'Sevilla'],
      ['tm-laliga-005', 'api_football', 'Real Betis'],
      ['tm-laliga-005', 'oddspapi', 'Real Betis'],
      ['tm-laliga-006', 'api_football', 'Valencia'],
      ['tm-laliga-006', 'oddspapi', 'Valencia'],
      // Serie A
      ['tm-seriea-001', 'api_football', 'Inter'],
      ['tm-seriea-001', 'oddspapi', 'Inter'],
      ['tm-seriea-001', 'api_football', 'Inter Milan'],
      ['tm-seriea-002', 'api_football', 'Juventus'],
      ['tm-seriea-002', 'oddspapi', 'Juventus'],
      ['tm-seriea-003', 'api_football', 'AC Milan'],
      ['tm-seriea-003', 'oddspapi', 'AC Milan'],
      ['tm-seriea-003', 'oddspapi', 'Milan'],
      ['tm-seriea-004', 'api_football', 'AS Roma'],
      ['tm-seriea-004', 'oddspapi', 'Roma'],
      ['tm-seriea-004', 'api_football', 'Roma'],
      ['tm-seriea-005', 'api_football', 'Napoli'],
      ['tm-seriea-005', 'oddspapi', 'Napoli'],
      // Bundesliga
      ['tm-bundesliga-001', 'api_football', 'Bayern Munich'],
      ['tm-bundesliga-001', 'oddspapi', 'Bayern Munich'],
      ['tm-bundesliga-002', 'api_football', 'Borussia Dortmund'],
      ['tm-bundesliga-002', 'oddspapi', 'Borussia Dortmund'],
      ['tm-bundesliga-002', 'oddspapi', 'Dortmund'],
      ['tm-bundesliga-003', 'api_football', 'Bayer Leverkusen'],
      ['tm-bundesliga-003', 'oddspapi', 'Bayer Leverkusen'],
      ['tm-bundesliga-003', 'oddspapi', 'Leverkusen'],
      ['tm-bundesliga-004', 'api_football', 'RB Leipzig'],
      ['tm-bundesliga-004', 'oddspapi', 'RB Leipzig'],
    ];

    mappings.forEach(([teamId, providerId, name]) => {
      this.registerAlias(teamId, providerId, name);
    });
  }

  public normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  public registerAlias(teamId: string, providerId: string, rawName: string): void {
    const key = `${providerId.toLowerCase()}:${this.normalizeName(rawName)}`;
    this.aliasMap.set(key, teamId);
    // Generic fallback key
    this.aliasMap.set(`generic:${this.normalizeName(rawName)}`, teamId);
  }

  public resolveTeamId(providerId: string, rawName: string): string {
    const key = `${providerId.toLowerCase()}:${this.normalizeName(rawName)}`;
    if (this.aliasMap.has(key)) {
      return this.aliasMap.get(key)!;
    }
    const genericKey = `generic:${this.normalizeName(rawName)}`;
    if (this.aliasMap.has(genericKey)) {
      return this.aliasMap.get(genericKey)!;
    }
    // Generate deterministic UUID for unregistered team
    const hash = crypto.createHash('md5').update(`${providerId}:${rawName.trim()}`).digest('hex');
    return `tm-auto-${hash.substring(0, 12)}`;
  }

  public getCanonicalTeam(teamId: string): CanonicalTeam | undefined {
    return this.teamCatalog.get(teamId);
  }
}

export const canonicalEntityResolver = new CanonicalEntityResolver();
