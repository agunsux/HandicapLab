/**
 * HandicapLab Replay Engine — Provider Interfaces
 * =================================================
 * Pure abstraction layer. The Prediction Engine never knows
 * whether data comes from live API, CSV, JSON, or Supabase.
 *
 * Only these interfaces connect replay to production.
 * No production code is modified.
 */

import { HistoricalMatch, HistoricalFixture, HistoricalOdds, HistoricalResult, ReplayContext } from './types';

/**
 * Loads historical fixtures for a given league/season.
 */
export interface FixtureProvider {
  readonly name: string;
  loadFixtures(context: ReplayContext): Promise<HistoricalFixture[]>;
}

/**
 * Loads historical odds for a set of fixtures.
 */
export interface OddsProvider {
  readonly name: string;
  loadOdds(fixtures: HistoricalFixture[], context: ReplayContext): Promise<HistoricalOdds[]>;
}

/**
 * Loads historical match results.
 */
export interface ResultProvider {
  readonly name: string;
  loadResults(fixtures: HistoricalFixture[], context: ReplayContext): Promise<HistoricalResult[]>;
}

/**
 * Composite provider that loads complete historical matches.
 */
export interface HistoricalDataProvider {
  readonly name: string;
  loadMatches(context: ReplayContext): Promise<HistoricalMatch[]>;
}

/**
 * Predictor abstraction — wraps the production Prediction Engine.
 * The replay system calls this, never touching engine internals.
 */
export interface Predictor {
  predict(features: Record<string, unknown>, marketOdds: number, marketSelection: string): Promise<{
    homeProbability: number;
    drawProbability: number;
    awayProbability: number;
    expectedValue: number;
    kellyFraction: number;
    stake: number;
  }>;
}