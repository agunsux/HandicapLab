import { BacktestConfig, BacktestEvent, IStakeStrategy } from './interfaces';
import { FlatStake } from './strategies/flatStake';
import { KellyStake } from './strategies/kellyStake';
import { MarketSimulator } from './marketSimulator';
import { MetricsEngine, BacktestSummaryMetrics } from './metricsEngine';

export class FeatureLeakageError extends Error {
  constructor(msg: string) {
    super(`[FeatureLeakageError] ${msg}`);
    this.name = 'FeatureLeakageError';
  }
}

export class BacktestEngine {
  private readonly config: BacktestConfig;
  private readonly stakeStrategy: IStakeStrategy;
  private readonly marketSimulator: MarketSimulator;
  private bankroll: number;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.bankroll = config.bankroll;
    this.marketSimulator = new MarketSimulator();

    if (config.stakeStrategy === 'KELLY') {
      this.stakeStrategy = new KellyStake();
    } else {
      this.stakeStrategy = new FlatStake();
    }
  }

  /**
   * Runs the deterministic event-driven backtesting execution loop.
   */
  public run(fixtures: any[], features: any[]): { metrics: BacktestSummaryMetrics; totalEvents: number } {
    // Generate chronological events list: OddsSnapshotArrived -> Prediction -> BetPlaced -> Settlement
    const events: BacktestEvent[] = [];

    // Enforce sorting chronologically by kickoff/snapshot times to prevent look-ahead bias
    const sortedFixtures = [...fixtures].sort(
      (a, b) => new Date(a.kickoffTime || a.kickoff_time).getTime() - new Date(b.kickoffTime || b.kickoff_time).getTime()
    );

    for (const fixture of sortedFixtures) {
      const kickoff = new Date(fixture.kickoffTime || fixture.kickoff_time).toISOString();

      // 1. Odds Arrived Event
      events.push({
        type: 'OddsSnapshotArrived',
        timestamp: kickoff,
        payload: { fixtureId: fixture.id || fixture.apiId, odds: fixture.odds || 2.0 }
      });

      // 2. Prediction Event
      events.push({
        type: 'PredictionGenerated',
        timestamp: kickoff,
        payload: { fixtureId: fixture.id || fixture.apiId, probability: fixture.predictedProbability || 0.55 }
      });
    }

    const stakes: number[] = [];
    const returns: number[] = [];
    const predictions: number[] = [];
    const outcomes: number[] = [];

    let totalEvents = 0;

    // Process events chronologically
    for (const event of events) {
      totalEvents++;
      const { type, timestamp, payload } = event;

      // 3. Point-in-time leak checks against historical features
      const relatedFeature = features.find(f => f.fixtureId === payload.fixtureId);
      if (relatedFeature) {
        const featureTime = new Date(relatedFeature.timestamp).getTime();
        const kickoffTime = new Date(timestamp).getTime();
        
        if (featureTime > kickoffTime) {
          throw new FeatureLeakageError(`Feature timestamp (${relatedFeature.timestamp}) is after event kickoff (${timestamp}).`);
        }
      }

      if (type === 'PredictionGenerated') {
        const fixture = sortedFixtures.find(f => (f.id || f.apiId) === payload.fixtureId);
        const odds = fixture?.odds || 2.0;

        // Apply stake sizing strategy
        const recommendedStake = this.stakeStrategy.calculateStake(
          odds,
          payload.probability,
          this.bankroll,
          this.config
        );

        if (recommendedStake > 0) {
          // Market execution simulation
          const execution = this.marketSimulator.simulateExecution(odds, recommendedStake, false, this.config.randomSeed);

          if (execution.status === 'EXECUTED') {
            this.bankroll -= execution.executedStake;
            
            // Determine result (1 for win, 0 for loss)
            const won = fixture?.result === 'H' || fixture?.home_goals > fixture?.away_goals;
            const betReturn = won ? execution.executedStake * execution.executedOdds : 0.0;
            
            this.bankroll += betReturn;

            stakes.push(execution.executedStake);
            returns.push(betReturn);
            predictions.push(payload.probability);
            outcomes.push(won ? 1 : 0);
          }
        }
      }
    }

    const metrics = MetricsEngine.computeSummary(stakes, returns, predictions, outcomes);
    return { metrics, totalEvents };
  }
}
