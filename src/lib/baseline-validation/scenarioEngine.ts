/**
 * EPIC 17.3 — Research Scenario Engine
 * Configurable and reproducible research scenario execution.
 * Supports seasons, leagues, filters, market types.
 */

import type { HistoricalMatch } from '../replay/types';
import type { ScenarioConfig, ScenarioResult, BaselineScenarioMetrics, ScenarioType } from './types';
import type { BaselineId } from '../replay-lab/types';
import { generateScenarioId } from './id';

export class ScenarioEngine {
  filterMatches(
    matches: readonly HistoricalMatch[],
    config: ScenarioConfig
  ): readonly HistoricalMatch[] {
    let filtered = [...matches];

    if (config.seasonIds) {
      filtered = filtered.filter((m) => config.seasonIds!.includes(m.fixture.season));
    }
    if (config.leagueIds) {
      filtered = filtered.filter((m) => config.leagueIds!.includes(m.fixture.leagueId));
    }
    if (config.homeOnly) {
      filtered = filtered.filter(() => true); // identity — filtering applied per-bet
    }
    if (config.awayOnly) {
      filtered = filtered.filter(() => true);
    }
    if (config.minOdds !== undefined) {
      filtered = filtered.filter((m) => m.odds.some((o) => (o.homeOdds ?? 0) >= config.minOdds!));
    }
    if (config.maxOdds !== undefined) {
      filtered = filtered.filter((m) => m.odds.some((o) => (o.homeOdds ?? Infinity) <= config.maxOdds!));
    }

    return filtered;
  }

  createScenario(
    config: ScenarioConfig,
    baselineResults: BaselineScenarioMetrics[]
  ): ScenarioResult {
    return {
      scenarioId: generateScenarioId(),
      config,
      baselineResults,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const defaultScenarioEngine = new ScenarioEngine();