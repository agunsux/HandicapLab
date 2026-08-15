import { RawApiFootballFixture, RawOddsPapiEvent } from '../../src/lib/integrity/dataIntegrityEngine';

// TEST_ONLY_SYNTHETIC_DATA
// These fixtures are completely synthetic and must never be imported or used in production paths.

export const RAW_API_FOOTBALL_FIXTURES: RawApiFootballFixture[] = [
  { fixtureId: 1208041, competition: 'Premier League', season: '2025-2026', homeTeamRaw: 'Manchester City', awayTeamRaw: 'Chelsea', kickoffUtc: '2026-08-22T16:30:00.000Z' },
  { fixtureId: 1208042, competition: 'Premier League', season: '2025-2026', homeTeamRaw: 'Arsenal', awayTeamRaw: 'Liverpool', kickoffUtc: '2026-08-23T15:30:00.000Z' },
  { fixtureId: 1208043, competition: 'Premier League', season: '2025-2026', homeTeamRaw: 'Tottenham', awayTeamRaw: 'Manchester United', kickoffUtc: '2026-08-23T13:00:00.000Z' },
  { fixtureId: 1214501, competition: 'La Liga', season: '2025-2026', homeTeamRaw: 'Real Madrid', awayTeamRaw: 'Atletico Madrid', kickoffUtc: '2026-08-22T19:00:00.000Z' },
  { fixtureId: 1214502, competition: 'La Liga', season: '2025-2026', homeTeamRaw: 'Barcelona', awayTeamRaw: 'Valencia', kickoffUtc: '2026-08-23T17:00:00.000Z' },
  { fixtureId: 1214503, competition: 'La Liga', season: '2025-2026', homeTeamRaw: 'Sevilla', awayTeamRaw: 'Real Betis', kickoffUtc: '2026-08-23T19:30:00.000Z' },
  { fixtureId: 1218901, competition: 'Serie A', season: '2025-2026', homeTeamRaw: 'Inter Milan', awayTeamRaw: 'Juventus', kickoffUtc: '2026-08-22T18:45:00.000Z' },
  { fixtureId: 1218902, competition: 'Serie A', season: '2025-2026', homeTeamRaw: 'AC Milan', awayTeamRaw: 'AS Roma', kickoffUtc: '2026-08-23T18:45:00.000Z' },
  { fixtureId: 1222101, competition: 'Bundesliga', season: '2025-2026', homeTeamRaw: 'Bayern Munich', awayTeamRaw: 'Borussia Dortmund', kickoffUtc: '2026-08-22T16:30:00.000Z' },
  { fixtureId: 1222102, competition: 'Bundesliga', season: '2025-2026', homeTeamRaw: 'Bayer Leverkusen', awayTeamRaw: 'RB Leipzig', kickoffUtc: '2026-08-23T14:30:00.000Z' },
];

export const RAW_ODDSPAPI_EVENTS: RawOddsPapiEvent[] = [
  { eventId: 'id1000001761301153', competition: 'Premier League', season: '2025-2026', homeTeamRaw: 'Manchester City', awayTeamRaw: 'Chelsea', kickoffUtc: '2026-08-22T16:30:00.000Z', bookmakers: ['pinnacle', 'circasports', 'sbobet'], marketIds: [101, 106, 108, 114], snapshotCount: 48 },
  { eventId: 'id1000001761301154', competition: 'Premier League', season: '2025-2026', homeTeamRaw: 'Arsenal', awayTeamRaw: 'Liverpool', kickoffUtc: '2026-08-23T15:30:00.000Z', bookmakers: ['pinnacle', 'circasports', 'sbobet'], marketIds: [101, 106, 108, 114], snapshotCount: 52 },
  { eventId: 'id1000001761301155', competition: 'Premier League', season: '2025-2026', homeTeamRaw: 'Tottenham', awayTeamRaw: 'Manchester United', kickoffUtc: '2026-08-23T13:00:00.000Z', bookmakers: ['pinnacle', 'circasports', 'sbobet'], marketIds: [101, 106, 108, 114], snapshotCount: 45 },
  { eventId: 'id1000001761301201', competition: 'La Liga', season: '2025-2026', homeTeamRaw: 'Real Madrid', awayTeamRaw: 'Atletico Madrid', kickoffUtc: '2026-08-22T19:00:00.000Z', bookmakers: ['pinnacle', 'circasports', 'sbobet'], marketIds: [101, 106, 108, 114], snapshotCount: 60 },
  { eventId: 'id1000001761301202', competition: 'La Liga', season: '2025-2026', homeTeamRaw: 'FC Barcelona', awayTeamRaw: 'Valencia', kickoffUtc: '2026-08-23T17:00:00.000Z', bookmakers: ['pinnacle', 'circasports', 'sbobet'], marketIds: [101, 106, 108, 114], snapshotCount: 42 },
  { eventId: 'id1000001761301203', competition: 'La Liga', season: '2025-2026', homeTeamRaw: 'Sevilla', awayTeamRaw: 'Real Betis', kickoffUtc: '2026-08-23T19:36:00.000Z', bookmakers: ['pinnacle', 'circasports', 'sbobet'], marketIds: [101, 106, 108, 114], snapshotCount: 38 },
  { eventId: 'id1000001761301301', competition: 'Serie A', season: '2025-2026', homeTeamRaw: 'Inter', awayTeamRaw: 'Juventus', kickoffUtc: '2026-08-22T18:45:00.000Z', bookmakers: ['pinnacle', 'circasports', 'sbobet'], marketIds: [101, 106, 108, 114], snapshotCount: 55 },
  { eventId: 'id1000001761301302', competition: 'Serie A', season: '2025-2026', homeTeamRaw: 'AC Milan', awayTeamRaw: 'Roma', kickoffUtc: '2026-08-23T18:45:00.000Z', bookmakers: ['pinnacle', 'circasports', 'sbobet'], marketIds: [101, 106, 108, 114], snapshotCount: 44 },
  { eventId: 'id1000001761301401', competition: 'Bundesliga', season: '2025-2026', homeTeamRaw: 'Bayern Munich', awayTeamRaw: 'Dortmund', kickoffUtc: '2026-08-22T16:30:00.000Z', bookmakers: ['pinnacle', 'circasports', 'sbobet'], marketIds: [101, 106, 108, 114], snapshotCount: 50 },
  { eventId: 'id1000001761301402', competition: 'Bundesliga', season: '2025-2026', homeTeamRaw: 'Leverkusen', awayTeamRaw: 'RB Leipzig', kickoffUtc: '2026-08-23T14:30:00.000Z', bookmakers: ['pinnacle', 'circasports', 'sbobet'], marketIds: [101, 106, 108, 114], snapshotCount: 46 },
];
