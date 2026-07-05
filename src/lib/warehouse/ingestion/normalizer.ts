import {
  CanonicalCompetition,
  CanonicalSeason,
  CanonicalTeam,
  CanonicalVenue,
  CanonicalReferee,
  CanonicalFixture,
  CanonicalStandings,
  CanonicalStandingRow,
  CanonicalPlayer,
  CanonicalBookmaker,
  CanonicalMarket,
  CanonicalOddsSnapshot,
  CanonicalOutcome
} from './canonical';
import { ParsingError, ValidationError } from './errors';

export class IngestionNormalizer {
  public static readonly VERSION = '1.0.0';

  public static toCompetition(raw: any, provider: string): CanonicalCompetition {
    try {
      if (!raw || !raw.id || !raw.name) {
        throw new ValidationError('Competition', ['Missing critical ID or Name fields']);
      }
      return {
        apiId: Number(raw.id),
        name: String(raw.name),
        country: String(raw.country || 'Unknown'),
        type: raw.type === 'cup' ? 'cup' : 'league',
        logoUrl: raw.logo || raw.logoUrl || undefined
      };
    } catch (err: any) {
      if (err instanceof ValidationError) throw err;
      throw new ParsingError(provider, 'Competition', err.message);
    }
  }

  public static toSeason(raw: any, provider: string): CanonicalSeason {
    try {
      if (!raw || !raw.competitionId || !raw.year) {
        throw new ValidationError('Season', ['Missing critical competitionId or year fields']);
      }
      return {
        competitionApiId: Number(raw.competitionId),
        year: Number(raw.year),
        startDate: raw.start || raw.startDate || undefined,
        endDate: raw.end || raw.endDate || undefined
      };
    } catch (err: any) {
      if (err instanceof ValidationError) throw err;
      throw new ParsingError(provider, 'Season', err.message);
    }
  }

  public static toTeam(raw: any, provider: string): CanonicalTeam {
    try {
      if (!raw || !raw.id || !raw.name) {
        throw new ValidationError('Team', ['Missing critical ID or Name fields']);
      }
      return {
        apiId: Number(raw.id),
        name: String(raw.name),
        country: raw.country || undefined,
        logoUrl: raw.logo || raw.logoUrl || undefined
      };
    } catch (err: any) {
      if (err instanceof ValidationError) throw err;
      throw new ParsingError(provider, 'Team', err.message);
    }
  }

  public static toFixture(raw: any, provider: string): CanonicalFixture {
    try {
      if (!raw || !raw.id || !raw.competitionId || !raw.homeTeamId || !raw.awayTeamId || !raw.kickoff) {
        throw new ValidationError('Fixture', [
          'Missing key fields: id, competitionId, homeTeamId, awayTeamId, kickoff'
        ]);
      }

      let status: CanonicalFixture['status'] = 'scheduled';
      const rawStatus = String(raw.status || '').toUpperCase();
      if (['FT', 'AET', 'PEN', 'FINISHED'].includes(rawStatus)) {
        status = 'finished';
      } else if (['1H', '2H', 'HT', 'ET', 'LIVE', 'IN_PLAY'].includes(rawStatus)) {
        status = 'live';
      } else if (['PST', 'POSTPONED'].includes(rawStatus)) {
        status = 'postponed';
      } else if (['CANC', 'CANCELLED'].includes(rawStatus)) {
        status = 'cancelled';
      } else if (['ABD', 'ABANDONED'].includes(rawStatus)) {
        status = 'abandoned';
      }

      let referee: CanonicalReferee | undefined;
      if (raw.refereeName) {
        referee = { name: String(raw.refereeName) };
      }

      let venue: CanonicalVenue | undefined;
      if (raw.venueName) {
        venue = { name: String(raw.venueName), city: raw.venueCity || undefined };
      }

      return {
        apiId: Number(raw.id),
        competitionApiId: Number(raw.competitionId),
        seasonYear: Number(raw.seasonYear || new Date(raw.kickoff).getFullYear()),
        kickoffTime: new Date(raw.kickoff).toISOString(),
        status,
        referee,
        venue,
        homeTeamApiId: Number(raw.homeTeamId),
        awayTeamApiId: Number(raw.awayTeamId),
        homeGoals: raw.homeGoals !== undefined && raw.homeGoals !== null ? Number(raw.homeGoals) : undefined,
        awayGoals: raw.awayGoals !== undefined && raw.awayGoals !== null ? Number(raw.awayGoals) : undefined,
        htHomeGoals: raw.htHomeGoals !== undefined && raw.htHomeGoals !== null ? Number(raw.htHomeGoals) : undefined,
        htAwayGoals: raw.htAwayGoals !== undefined && raw.htAwayGoals !== null ? Number(raw.htAwayGoals) : undefined,
        detailsJson: raw.details || {}
      };
    } catch (err: any) {
      if (err instanceof ValidationError) throw err;
      throw new ParsingError(provider, 'Fixture', err.message);
    }
  }

  public static toOddsSnapshot(raw: any, provider: string): CanonicalOddsSnapshot {
    try {
      if (!raw || !raw.fixtureId || !raw.bookmakerId || !raw.marketId || !raw.timestamp || !raw.outcomes) {
        throw new ValidationError('OddsSnapshot', [
          'Missing key fields: fixtureId, bookmakerId, marketId, timestamp, outcomes'
        ]);
      }

      const outcomes: CanonicalOutcome[] = (raw.outcomes || []).map((o: any) => {
        const odds = Number(o.odds);
        if (isNaN(odds) || odds <= 1.0) {
          throw new ValidationError('Outcome', [`Invalid odds value: ${o.odds}`]);
        }
        return {
          selection: String(o.selection),
          odds
        };
      });

      return {
        fixtureId: Number(raw.fixtureId),
        bookmakerId: Number(raw.bookmakerId),
        marketId: Number(raw.marketId),
        timestamp: new Date(raw.timestamp).toISOString(),
        outcomes
      };
    } catch (err: any) {
      if (err instanceof ValidationError) throw err;
      throw new ParsingError(provider, 'OddsSnapshot', err.message);
    }
  }
}
