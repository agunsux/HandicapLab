// HandicapLab Live Data Platform - Football Data CSV Adapter
// Location: src/lib/data-platform/footballDataCSVAdapter.ts

import {
  CanonicalFixture,
  CanonicalOdds,
  CanonicalTeam,
  CanonicalLineup,
  CanonicalInjury,
  CanonicalReferee,
  CanonicalTeamStats,
  CanonicalEvent
} from './canonicalModel';
import crypto from 'crypto';

export class FootballDataCSVAdapter {
  private static playerRosters: Record<string, string[]> = {};

  // Simple seedable random helper for reproducible timelines and rosters
  private static seededRandom(seedStr: string): () => number {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    return () => {
      const x = Math.sin(hash++) * 10000;
      return x - Math.floor(x);
    };
  }

  private static getOrGenerateRoster(teamName: string): string[] {
    if (this.playerRosters[teamName]) {
      return this.playerRosters[teamName];
    }
    const rand = this.seededRandom(teamName);
    const firstNames = ['John', 'David', 'James', 'Michael', 'Robert', 'William', 'Thomas', 'Daniel', 'Paul', 'Mark', 'Alex', 'Kevin', 'Chris', 'Harry', 'Marcus', 'Jordan'];
    const lastNames = ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Robinson', 'Wright', 'Thompson', 'Evans', 'Walker', 'Kane', 'Salah', 'Foden'];
    
    const roster: string[] = [];
    for (let i = 0; i < 22; i++) {
      const fn = firstNames[Math.floor(rand() * firstNames.length)];
      const ln = lastNames[Math.floor(rand() * lastNames.length)];
      roster.push(`${fn} ${ln}`);
    }
    this.playerRosters[teamName] = roster;
    return roster;
  }

  public static parseCSVRow(
    row: any,
    idx: number,
    season: string
  ): {
    fixture: CanonicalFixture;
    oddsOpen: CanonicalOdds[];
    oddsClose: CanonicalOdds[];
    events: CanonicalEvent[];
    lineups: CanonicalLineup[];
    injuries: CanonicalInjury[];
    referee: CanonicalReferee;
    teamStats: CanonicalTeamStats[];
    weather: any;
  } {
    const rand = this.seededRandom(`${season}:${row.HomeTeam}:${row.AwayTeam}:${idx}`);
    
    const homeTeam = row.HomeTeam?.trim() || 'HomeTeam';
    const awayTeam = row.AwayTeam?.trim() || 'AwayTeam';
    
    // Parse Date and Time
    const dateStr = row.Date?.trim();
    const timeStr = row.Time?.trim() || '15:00';
    let kickoffISO = new Date().toISOString();
    if (dateStr) {
      const dateParts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10);
      let year = parseInt(dateParts[2], 10);
      if (year < 100) year += 2000;
      
      const [hours, minutes] = timeStr.split(':').map((x: string) => parseInt(x, 10) || 0);
      kickoffISO = new Date(Date.UTC(year, month - 1, day, hours || 12, minutes || 0)).toISOString();
    }
    
    const fixtureId = crypto
      .createHash('md5')
      .update(`${season}:${homeTeam}:${awayTeam}:${kickoffISO}`)
      .digest('hex');

    const homeGoals = row.FTHG !== undefined && row.FTHG !== '' ? parseInt(row.FTHG, 10) : null;
    const awayGoals = row.FTAG !== undefined && row.FTAG !== '' ? parseInt(row.FTAG, 10) : null;
    
    const fixture: CanonicalFixture = {
      match_id: fixtureId,
      provider_id: `csv-${idx}`,
      provider: 'FootballData',
      competition_id: 'EPL',
      season: '2023-2024',
      home_team_id: homeTeam.toLowerCase().replace(/[^a-z0-9]/g, ''),
      away_team_id: awayTeam.toLowerCase().replace(/[^a-z0-9]/g, ''),
      kickoff: kickoffISO,
      home_goals: homeGoals,
      away_goals: awayGoals,
      home_xg: null,
      away_xg: null,
      home_shots: parseInt(row.HS, 10) || null,
      away_shots: parseInt(row.AS, 10) || null,
      home_shots_on_target: parseInt(row.HST, 10) || null,
      away_shots_on_target: parseInt(row.AST, 10) || null,
      status: 'FINISHED',
      schema_version: '1.0.0',
      generated_at: new Date().toISOString(),
      checksum: 'dummy'
    };

    // Extract Odds (betting lines)
    const openH = parseFloat(row.B365H) || 2.0;
    const openD = parseFloat(row.B365D) || 3.2;
    const openA = parseFloat(row.B365A) || 3.0;

    const closeH = parseFloat(row.B365CH) || openH;
    const closeD = parseFloat(row.B365CD) || openD;
    const closeA = parseFloat(row.B365CA) || openA;

    // Over/Under 2.5
    const openOver = parseFloat(row['B365>2.5']) || 1.9;
    const openUnder = parseFloat(row['B365<2.5']) || 1.9;

    const closeOver = parseFloat(row['B365C>2.5']) || openOver;
    const closeUnder = parseFloat(row['B365C<2.5']) || openUnder;

    // Asian Handicap line and odds
    const openLine = parseFloat(row.AHh) || 0.0;
    const openAHH = parseFloat(row.B365AHH) || 1.9;
    const openAHA = parseFloat(row.B365AHA) || 1.9;

    const closeLine = parseFloat(row.AHCh) || openLine;
    const closeAHH = parseFloat(row.B365CAHH) || openAHH;
    const closeAHA = parseFloat(row.B365CAHA) || openAHA;

    const oddsOpen: CanonicalOdds[] = [
      { fixtureId, provider: 'Pinnacle', marketType: 'ML', selection: 'home', oddsDecimal: openH, impliedProbability: 1 / openH, receivedAt: new Date(new Date(kickoffISO).getTime() - 48 * 3600 * 1000).toISOString(), providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 5, normalizerVersion: '1.0' },
      { fixtureId, provider: 'Pinnacle', marketType: 'ML', selection: 'draw', oddsDecimal: openD, impliedProbability: 1 / openD, receivedAt: new Date(new Date(kickoffISO).getTime() - 48 * 3600 * 1000).toISOString(), providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 5, normalizerVersion: '1.0' },
      { fixtureId, provider: 'Pinnacle', marketType: 'ML', selection: 'away', oddsDecimal: openA, impliedProbability: 1 / openA, receivedAt: new Date(new Date(kickoffISO).getTime() - 48 * 3600 * 1000).toISOString(), providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 5, normalizerVersion: '1.0' },
      { fixtureId, provider: 'Pinnacle', marketType: 'OU', selection: 'over', line: 2.5, oddsDecimal: openOver, impliedProbability: 1 / openOver, receivedAt: new Date(new Date(kickoffISO).getTime() - 48 * 3600 * 1000).toISOString(), providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 5, normalizerVersion: '1.0' },
      { fixtureId, provider: 'Pinnacle', marketType: 'OU', selection: 'under', line: 2.5, oddsDecimal: openUnder, impliedProbability: 1 / openUnder, receivedAt: new Date(new Date(kickoffISO).getTime() - 48 * 3600 * 1000).toISOString(), providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 5, normalizerVersion: '1.0' },
      { fixtureId, provider: 'Pinnacle', marketType: 'AH', selection: 'home', line: openLine, oddsDecimal: openAHH, impliedProbability: 1 / openAHH, receivedAt: new Date(new Date(kickoffISO).getTime() - 48 * 3600 * 1000).toISOString(), providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 5, normalizerVersion: '1.0' },
      { fixtureId, provider: 'Pinnacle', marketType: 'AH', selection: 'away', line: -openLine, oddsDecimal: openAHA, impliedProbability: 1 / openAHA, receivedAt: new Date(new Date(kickoffISO).getTime() - 48 * 3600 * 1000).toISOString(), providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 5, normalizerVersion: '1.0' }
    ];

    const oddsClose: CanonicalOdds[] = [
      { fixtureId, provider: 'Pinnacle', marketType: 'ML', selection: 'home', oddsDecimal: closeH, impliedProbability: 1 / closeH, receivedAt: kickoffISO, providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 12, normalizerVersion: '1.0' },
      { fixtureId, provider: 'Pinnacle', marketType: 'ML', selection: 'draw', oddsDecimal: closeD, impliedProbability: 1 / closeD, receivedAt: kickoffISO, providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 12, normalizerVersion: '1.0' },
      { fixtureId, provider: 'Pinnacle', marketType: 'ML', selection: 'away', oddsDecimal: closeA, impliedProbability: 1 / closeA, receivedAt: kickoffISO, providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 12, normalizerVersion: '1.0' },
      { fixtureId, provider: 'Pinnacle', marketType: 'OU', selection: 'over', line: 2.5, oddsDecimal: closeOver, impliedProbability: 1 / closeOver, receivedAt: kickoffISO, providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 12, normalizerVersion: '1.0' },
      { fixtureId, provider: 'Pinnacle', marketType: 'OU', selection: 'under', line: 2.5, oddsDecimal: closeUnder, impliedProbability: 1 / closeUnder, receivedAt: kickoffISO, providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 12, normalizerVersion: '1.0' },
      { fixtureId, provider: 'Pinnacle', marketType: 'AH', selection: 'home', line: closeLine, oddsDecimal: closeAHH, impliedProbability: 1 / closeAHH, receivedAt: kickoffISO, providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 12, normalizerVersion: '1.0' },
      { fixtureId, provider: 'Pinnacle', marketType: 'AH', selection: 'away', line: -closeLine, oddsDecimal: closeAHA, impliedProbability: 1 / closeAHA, receivedAt: kickoffISO, providerTimestamp: kickoffISO, processedTimestamp: kickoffISO, latencyMs: 12, normalizerVersion: '1.0' }
    ];

    // Build timeline event updates: Opening, 6h before, 3h before, 1h before, Closing
    const timelineIntervals = [
      { key: 'opened', hoursBefore: 48, oddsScale: 0.0 },
      { key: '6h_before', hoursBefore: 6, oddsScale: 0.25 },
      { key: '3h_before', hoursBefore: 3, oddsScale: 0.5 },
      { key: '1h_before', hoursBefore: 1, oddsScale: 0.75 },
      { key: 'closed', hoursBefore: 0, oddsScale: 1.0 }
    ];

    const events: CanonicalEvent[] = [];

    timelineIntervals.forEach((interval) => {
      const occurrenceTime = new Date(new Date(kickoffISO).getTime() - interval.hoursBefore * 3600 * 1000).toISOString();
      const interp = (openVal: number, closeVal: number) => {
        return Number((openVal + (closeVal - openVal) * interval.oddsScale).toFixed(3));
      };

      const oddsUpdate = {
        homeML: interp(openH, closeH),
        drawML: interp(openD, closeD),
        awayML: interp(openA, closeA),
        over25: interp(openOver, closeOver),
        under25: interp(openUnder, closeUnder),
        homeAH: interp(openAHH, closeAHH),
        awayAH: interp(openAHA, closeAHA),
        lineAH: interp(openLine, closeLine)
      };

      const eventType = interval.key === 'opened' ? 'OddsOpened' : interval.key === 'closed' ? 'OddsClosed' : 'OddsUpdated';

      const payload = {
        fixtureId,
        provider: 'Pinnacle',
        odds: oddsUpdate,
        timestamp: occurrenceTime
      };

      const checksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');

      events.push({
        eventId: crypto.randomUUID(),
        fixtureId,
        eventType,
        occurredAt: occurrenceTime,
        payload,
        checksum,
        eventVersion: '1.0.0'
      });
    });

    // Lineups Generation
    const homeRoster = this.getOrGenerateRoster(homeTeam);
    const awayRoster = this.getOrGenerateRoster(awayTeam);

    const lineups: CanonicalLineup[] = [];
    const positions = ['G', 'D', 'D', 'D', 'D', 'M', 'M', 'M', 'F', 'F', 'F', 'SUB', 'SUB', 'SUB', 'SUB', 'SUB'];

    for (let i = 0; i < 16; i++) {
      lineups.push({
        fixtureId,
        teamId: fixture.home_team_id,
        playerId: `h-player-${i}`,
        playerName: homeRoster[i],
        position: positions[i],
        role: i < 11 ? 'STARTER' : 'SUBSTITUTE'
      });

      lineups.push({
        fixtureId,
        teamId: fixture.away_team_id,
        playerId: `a-player-${i}`,
        playerName: awayRoster[i],
        position: positions[i],
        role: i < 11 ? 'STARTER' : 'SUBSTITUTE'
      });
    }

    // Injuries Generation
    const injuries: CanonicalInjury[] = [];
    if (rand() > 0.6) {
      injuries.push({
        fixtureId,
        teamId: fixture.home_team_id,
        playerId: 'h-player-18',
        playerName: homeRoster[18],
        injuryType: 'Hamstring Strain',
        status: 'OUT',
        expectedReturnDate: new Date(new Date(kickoffISO).getTime() + 14 * 24 * 3600 * 1000).toISOString()
      });
    }
    if (rand() > 0.6) {
      injuries.push({
        fixtureId,
        teamId: fixture.away_team_id,
        playerId: 'a-player-19',
        playerName: awayRoster[19],
        injuryType: 'Ankle Sprain',
        status: 'DOUBTFUL',
        expectedReturnDate: new Date(new Date(kickoffISO).getTime() + 7 * 24 * 3600 * 1000).toISOString()
      });
    }

    // Referee stats
    const hsCards = parseInt(row.HY, 10) || 0;
    const asCards = parseInt(row.AY, 10) || 0;
    const hsReds = parseInt(row.HR, 10) || 0;
    const asReds = parseInt(row.AR, 10) || 0;

    const referee: CanonicalReferee = {
      refereeName: row.Referee || 'Unknown Referee',
      date: kickoffISO,
      matchId: fixtureId,
      yellowCards: hsCards + asCards,
      redCards: hsReds + asReds,
      foulsCalled: (parseInt(row.HF, 10) || 12) + (parseInt(row.AF, 10) || 12)
    };

    // Team stats
    const teamStats: CanonicalTeamStats[] = [
      {
        fixtureId,
        teamName: homeTeam,
        shots: parseInt(row.HS, 10) || 0,
        shotsOnTarget: parseInt(row.HST, 10) || 0,
        corners: parseInt(row.HC, 10) || 0,
        fouls: parseInt(row.HF, 10) || 0,
        yellowCards: hsCards,
        redCards: hsReds
      },
      {
        fixtureId,
        teamName: awayTeam,
        shots: parseInt(row.AS, 10) || 0,
        shotsOnTarget: parseInt(row.AST, 10) || 0,
        corners: parseInt(row.AC, 10) || 0,
        fouls: parseInt(row.AF, 10) || 0,
        yellowCards: asCards,
        redCards: asReds
      }
    ];

    // Weather Simulation
    const weatherConditions = ['Sunny', 'Rainy', 'Windy', 'Overcast'];
    const weather = {
      fixtureId,
      condition: weatherConditions[Math.floor(rand() * weatherConditions.length)],
      tempC: Number((10 + rand() * 15).toFixed(1)),
      humidityPct: Math.floor(50 + rand() * 40),
      windSpeedKph: Number((5 + rand() * 25).toFixed(1))
    };

    return {
      fixture,
      oddsOpen,
      oddsClose,
      events,
      lineups,
      injuries,
      referee,
      teamStats,
      weather
    };
  }
}
