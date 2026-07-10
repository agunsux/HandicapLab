/**
 * HandicapLab Mock Replay Data Provider
 * ======================================
 * Provides 15 historical EPL matches for end-to-end replay testing.
 * Uses a built-in JSON dataset — no external files needed.
 *
 * The Predictor mock returns deterministic values to verify
 * the replay pipeline works end-to-end without touching
 * the production Prediction Engine.
 */

import { HistoricalFixture, HistoricalOdds, HistoricalResult, HistoricalMatch, ReplayContext } from './types';
import { HistoricalDataProvider } from './providers';

const MOCK_FIXTURES: HistoricalFixture[] = [
  { id: 'epl-001', homeTeam: 'Liverpool', awayTeam: 'Wolves', kickoff: '2024-08-17T15:00:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-002', homeTeam: 'Arsenal', awayTeam: 'Brighton', kickoff: '2024-08-17T17:30:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-003', homeTeam: 'Man City', awayTeam: 'Chelsea', kickoff: '2024-08-18T16:00:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-004', homeTeam: 'Man United', awayTeam: 'Fulham', kickoff: '2024-08-16T20:00:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-005', homeTeam: 'Tottenham', awayTeam: 'Leicester', kickoff: '2024-08-19T20:00:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-006', homeTeam: 'Chelsea', awayTeam: 'Liverpool', kickoff: '2024-08-25T16:30:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-007', homeTeam: 'Wolves', awayTeam: 'Man City', kickoff: '2024-08-25T14:00:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-008', homeTeam: 'Brighton', awayTeam: 'Man United', kickoff: '2024-08-24T12:30:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-009', homeTeam: 'Fulham', awayTeam: 'Arsenal', kickoff: '2024-08-24T15:00:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-010', homeTeam: 'Leicester', awayTeam: 'Tottenham', kickoff: '2024-08-26T20:00:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-011', homeTeam: 'Arsenal', awayTeam: 'Wolves', kickoff: '2024-09-01T14:00:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-012', homeTeam: 'Liverpool', awayTeam: 'Man United', kickoff: '2024-09-01T16:30:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-013', homeTeam: 'Man City', awayTeam: 'Arsenal', kickoff: '2024-09-22T16:30:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-014', homeTeam: 'Chelsea', awayTeam: 'Tottenham', kickoff: '2024-09-15T14:00:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
  { id: 'epl-015', homeTeam: 'Liverpool', awayTeam: 'Arsenal', kickoff: '2024-10-27T16:30:00Z', leagueId: '39', season: '2024-2025', status: 'finished' },
];

const MOCK_ODDS: HistoricalOdds[] = [
  { fixtureId: 'epl-001', market: 'ML', openingHomeOdds: 1.40, closingHomeOdds: 1.35, openingDrawOdds: 5.00, closingDrawOdds: 5.50, openingAwayOdds: 7.50, closingAwayOdds: 8.00, homeOdds: 1.35, drawOdds: 5.50, awayOdds: 8.00, timestamp: '2024-08-17T14:00:00Z' },
  { fixtureId: 'epl-002', market: 'ML', openingHomeOdds: 1.33, closingHomeOdds: 1.30, openingDrawOdds: 5.50, closingDrawOdds: 5.80, openingAwayOdds: 8.00, closingAwayOdds: 8.50, homeOdds: 1.30, drawOdds: 5.80, awayOdds: 8.50, timestamp: '2024-08-17T16:30:00Z' },
  { fixtureId: 'epl-003', market: 'ML', openingHomeOdds: 1.50, closingHomeOdds: 1.45, openingDrawOdds: 4.50, closingDrawOdds: 4.80, openingAwayOdds: 6.50, closingAwayOdds: 7.00, homeOdds: 1.45, drawOdds: 4.80, awayOdds: 7.00, timestamp: '2024-08-18T15:00:00Z' },
  { fixtureId: 'epl-004', market: 'ML', openingHomeOdds: 1.65, closingHomeOdds: 1.60, openingDrawOdds: 4.00, closingDrawOdds: 4.20, openingAwayOdds: 5.50, closingAwayOdds: 5.80, homeOdds: 1.60, drawOdds: 4.20, awayOdds: 5.80, timestamp: '2024-08-16T19:00:00Z' },
  { fixtureId: 'epl-005', market: 'ML', openingHomeOdds: 1.55, closingHomeOdds: 1.50, openingDrawOdds: 4.20, closingDrawOdds: 4.50, openingAwayOdds: 6.00, closingAwayOdds: 6.50, homeOdds: 1.50, drawOdds: 4.50, awayOdds: 6.50, timestamp: '2024-08-19T19:00:00Z' },
  { fixtureId: 'epl-006', market: 'ML', openingHomeOdds: 2.10, closingHomeOdds: 2.05, openingDrawOdds: 3.50, closingDrawOdds: 3.60, openingAwayOdds: 3.40, closingAwayOdds: 3.50, homeOdds: 2.05, drawOdds: 3.60, awayOdds: 3.50, timestamp: '2024-08-25T15:30:00Z' },
  { fixtureId: 'epl-007', market: 'ML', openingHomeOdds: 5.50, closingHomeOdds: 6.00, openingDrawOdds: 4.00, closingDrawOdds: 4.20, openingAwayOdds: 1.60, closingAwayOdds: 1.55, homeOdds: 6.00, drawOdds: 4.20, awayOdds: 1.55, timestamp: '2024-08-25T13:00:00Z' },
  { fixtureId: 'epl-008', market: 'ML', openingHomeOdds: 2.80, closingHomeOdds: 2.70, openingDrawOdds: 3.40, closingDrawOdds: 3.50, openingAwayOdds: 2.45, closingAwayOdds: 2.40, homeOdds: 2.70, drawOdds: 3.50, awayOdds: 2.40, timestamp: '2024-08-24T11:30:00Z' },
  { fixtureId: 'epl-009', market: 'ML', openingHomeOdds: 4.00, closingHomeOdds: 4.20, openingDrawOdds: 3.60, closingDrawOdds: 3.70, openingAwayOdds: 1.85, closingAwayOdds: 1.80, homeOdds: 4.20, drawOdds: 3.70, awayOdds: 1.80, timestamp: '2024-08-24T14:00:00Z' },
  { fixtureId: 'epl-010', market: 'ML', openingHomeOdds: 3.80, closingHomeOdds: 4.00, openingDrawOdds: 3.50, closingDrawOdds: 3.60, openingAwayOdds: 1.90, closingAwayOdds: 1.85, homeOdds: 4.00, drawOdds: 3.60, awayOdds: 1.85, timestamp: '2024-08-26T19:00:00Z' },
  { fixtureId: 'epl-011', market: 'ML', openingHomeOdds: 1.28, closingHomeOdds: 1.25, openingDrawOdds: 5.80, closingDrawOdds: 6.00, openingAwayOdds: 9.00, closingAwayOdds: 10.00, homeOdds: 1.25, drawOdds: 6.00, awayOdds: 10.00, timestamp: '2024-09-01T13:00:00Z' },
  { fixtureId: 'epl-012', market: 'ML', openingHomeOdds: 1.55, closingHomeOdds: 1.50, openingDrawOdds: 4.20, closingDrawOdds: 4.50, openingAwayOdds: 6.00, closingAwayOdds: 6.50, homeOdds: 1.50, drawOdds: 4.50, awayOdds: 6.50, timestamp: '2024-09-01T15:30:00Z' },
  { fixtureId: 'epl-013', market: 'ML', openingHomeOdds: 1.75, closingHomeOdds: 1.70, openingDrawOdds: 3.80, closingDrawOdds: 4.00, openingAwayOdds: 4.50, closingAwayOdds: 4.80, homeOdds: 1.70, drawOdds: 4.00, awayOdds: 4.80, timestamp: '2024-09-22T15:30:00Z' },
  { fixtureId: 'epl-014', market: 'ML', openingHomeOdds: 1.85, closingHomeOdds: 1.80, openingDrawOdds: 3.70, closingDrawOdds: 3.80, openingAwayOdds: 4.00, closingAwayOdds: 4.20, homeOdds: 1.80, drawOdds: 3.80, awayOdds: 4.20, timestamp: '2024-09-15T13:00:00Z' },
  { fixtureId: 'epl-015', market: 'ML', openingHomeOdds: 2.15, closingHomeOdds: 2.10, openingDrawOdds: 3.60, closingDrawOdds: 3.70, openingAwayOdds: 3.20, closingAwayOdds: 3.30, homeOdds: 2.10, drawOdds: 3.70, awayOdds: 3.30, timestamp: '2024-10-27T15:30:00Z' },
];

const MOCK_RESULTS: HistoricalResult[] = [
  { fixtureId: 'epl-001', homeGoals: 3, awayGoals: 0, status: 'finished' },
  { fixtureId: 'epl-002', homeGoals: 2, awayGoals: 1, status: 'finished' },
  { fixtureId: 'epl-003', homeGoals: 1, awayGoals: 0, status: 'finished' },
  { fixtureId: 'epl-004', homeGoals: 1, awayGoals: 0, status: 'finished' },
  { fixtureId: 'epl-005', homeGoals: 1, awayGoals: 1, status: 'finished' },
  { fixtureId: 'epl-006', homeGoals: 2, awayGoals: 1, status: 'finished' },
  { fixtureId: 'epl-007', homeGoals: 0, awayGoals: 3, status: 'finished' },
  { fixtureId: 'epl-008', homeGoals: 1, awayGoals: 2, status: 'finished' },
  { fixtureId: 'epl-009', homeGoals: 0, awayGoals: 1, status: 'finished' },
  { fixtureId: 'epl-010', homeGoals: 1, awayGoals: 1, status: 'finished' },
  { fixtureId: 'epl-011', homeGoals: 3, awayGoals: 0, status: 'finished' },
  { fixtureId: 'epl-012', homeGoals: 2, awayGoals: 2, status: 'finished' },
  { fixtureId: 'epl-013', homeGoals: 2, awayGoals: 1, status: 'finished' },
  { fixtureId: 'epl-014', homeGoals: 1, awayGoals: 0, status: 'finished' },
  { fixtureId: 'epl-015', homeGoals: 2, awayGoals: 1, status: 'finished' },
];

export class MockReplayDataProvider implements HistoricalDataProvider {
  readonly name = 'Mock EPL 2024-25';

  async loadMatches(context: ReplayContext): Promise<HistoricalMatch[]> {
    const fixtures = MOCK_FIXTURES.filter((f) => {
      if (context.leagueId && f.leagueId !== context.leagueId) return false;
      return true;
    });

    return fixtures.map((fixture) => {
      const odds = MOCK_ODDS.filter((o) => o.fixtureId === fixture.id);
      const result = MOCK_RESULTS.find((r) => r.fixtureId === fixture.id);
      return { fixture, odds, result };
    });
  }
}

// Also export the raw data for dataset loader tests
export { MOCK_FIXTURES, MOCK_ODDS, MOCK_RESULTS };