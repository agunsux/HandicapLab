// EPIC 35 — Supabase-Backed Live Validation Store
// Implements the append-only LiveValidationStore interface over PostgreSQL/Supabase.
// Falls back or handles DB connection gracefully.

import { supabase } from '../../lib/supabase.server';
import type {
  PredictionSnapshotRecord,
  OddsSnapshotRecordLV,
  SettlementRecordLV,
  RollingMetricsRecord,
  CalibrationHistoryRecord,
  DriftEventRecord,
  AlertRecord,
  WeeklyReportRecord,
  OddsPhase,
  LiveMarketKind,
} from '../types';
import {
  LiveValidationStore,
  DuplicateRecordError,
} from './types';

export class SupabaseLiveValidationStore implements LiveValidationStore {
  // ─── prediction_snapshots ─────────────────────────────────────────────

  async appendPrediction(record: PredictionSnapshotRecord): Promise<void> {
    const { error } = await supabase.from('prediction_snapshots').insert({
      id: record.id,
      fixture_id: record.fixture.fixtureId,
      league: record.fixture.league,
      season: record.fixture.season,
      home_team: record.fixture.homeTeam,
      away_team: record.fixture.awayTeam,
      kickoff: record.fixture.kickoff,
      model_version: record.model.modelVersion,
      feature_version: record.model.featureVersion,
      calibration_version: record.model.calibrationVersion,
      research_manifest_version: record.model.researchManifestVersion,
      git_commit: record.model.gitCommit,
      prediction_timestamp: record.model.predictionTimestamp,
      home_prob: record.prediction.homeProb,
      draw_prob: record.prediction.drawProb,
      away_prob: record.prediction.awayProb,
      expected_goals_home: record.prediction.expectedGoalsHome,
      expected_goals_away: record.prediction.expectedGoalsAway,
      confidence: record.prediction.confidence,
      expected_value: record.prediction.expectedValue,
      asian_handicap: record.prediction.asianHandicap,
      over_under: record.prediction.overUnder,
      moneyline: record.prediction.moneyline,
      prediction_odds: record.market.predictionOdds,
      idempotency_key: record.idempotencyKey,
      input_hash: record.inputHash,
      chain_hash: record.chainHash,
      previous_snapshot_id: record.previousSnapshotId,
      created_at: record.createdAt,
      created_by: record.createdBy,
      schema_version: record.schemaVersion,
      correlation_id: record.correlationId,
    });

    if (error) {
      if (error.code === '23505') {
        throw new DuplicateRecordError('prediction_snapshots', record.idempotencyKey);
      }
      throw new Error(`Failed to append prediction: ${error.message}`);
    }
  }

  async getPrediction(id: string): Promise<PredictionSnapshotRecord | null> {
    const { data, error } = await supabase
      .from('prediction_snapshots')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapPredictionRow(data);
  }

  async getPredictionByIdempotencyKey(key: string): Promise<PredictionSnapshotRecord | null> {
    const { data, error } = await supabase
      .from('prediction_snapshots')
      .select('*')
      .eq('idempotency_key', key)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapPredictionRow(data);
  }

  async hasPredictionForFixture(fixtureId: string): Promise<boolean> {
    const { data } = await supabase
      .from('prediction_snapshots')
      .select('id')
      .eq('fixture_id', fixtureId)
      .limit(1);

    return Array.isArray(data) && data.length > 0;
  }

  async listPredictions(filter?: {
    from?: string;
    to?: string;
    league?: string;
    fixtureId?: string;
  }): Promise<PredictionSnapshotRecord[]> {
    let query = supabase.from('prediction_snapshots').select('*').order('created_at', { ascending: true });

    if (filter?.from) query = query.gte('prediction_timestamp', filter.from);
    if (filter?.to) query = query.lte('prediction_timestamp', filter.to);
    if (filter?.league) query = query.eq('league', filter.league);
    if (filter?.fixtureId) query = query.eq('fixture_id', filter.fixtureId);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(row => this.mapPredictionRow(row));
  }

  async getLastPrediction(): Promise<PredictionSnapshotRecord | null> {
    const { data } = await supabase
      .from('prediction_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return this.mapPredictionRow(data);
  }

  private mapPredictionRow(row: any): PredictionSnapshotRecord {
    return {
      id: row.id,
      fixture: {
        fixtureId: row.fixture_id,
        league: row.league,
        season: row.season,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        kickoff: row.kickoff,
      },
      model: {
        modelVersion: row.model_version,
        featureVersion: row.feature_version,
        calibrationVersion: row.calibration_version,
        researchManifestVersion: row.research_manifest_version,
        gitCommit: row.git_commit,
        predictionTimestamp: row.prediction_timestamp,
      },
      prediction: {
        homeProb: Number(row.home_prob),
        drawProb: Number(row.draw_prob),
        awayProb: Number(row.away_prob),
        expectedGoalsHome: Number(row.expected_goals_home),
        expectedGoalsAway: Number(row.expected_goals_away),
        asianHandicap: row.asian_handicap,
        overUnder: row.over_under,
        moneyline: row.moneyline,
        confidence: Number(row.confidence),
        expectedValue: Number(row.expected_value),
      },
      market: {
        predictionOdds: row.prediction_odds || [],
      },
      idempotencyKey: row.idempotency_key,
      inputHash: row.input_hash,
      chainHash: row.chain_hash,
      previousSnapshotId: row.previous_snapshot_id,
      createdAt: row.created_at,
      createdBy: row.created_by,
      schemaVersion: row.schema_version,
      correlationId: row.correlation_id,
    };
  }

  // ─── odds_snapshots ──────────────────────────────────────────────────

  async appendOddsSnapshot(record: OddsSnapshotRecordLV): Promise<void> {
    const { error } = await supabase.from('odds_snapshots').insert({
      id: record.id,
      fixture_id: record.fixtureId,
      phase: record.phase,
      market: record.quote.market,
      line: record.quote.line,
      price_home: record.quote.priceHome,
      price_away: record.quote.priceAway,
      price_draw: record.quote.priceDraw,
      bookmaker: record.quote.bookmaker,
      captured_at: record.capturedAt,
      chain_hash: record.chainHash,
      previous_snapshot_id: record.previousSnapshotId,
      created_at: record.createdAt,
      created_by: record.createdBy,
      schema_version: record.schemaVersion,
      correlation_id: record.correlationId,
    });

    if (error) throw new Error(`Failed to append odds snapshot: ${error.message}`);
  }

  async listOddsSnapshots(fixtureId: string): Promise<OddsSnapshotRecordLV[]> {
    const { data, error } = await supabase
      .from('odds_snapshots')
      .select('*')
      .eq('fixture_id', fixtureId)
      .order('captured_at', { ascending: true });

    if (error || !data) return [];
    return data.map(row => ({
      id: row.id,
      fixtureId: row.fixture_id,
      phase: row.phase as OddsPhase,
      quote: {
        market: row.market as LiveMarketKind,
        line: Number(row.line),
        priceHome: Number(row.price_home),
        priceAway: Number(row.price_away),
        priceDraw: row.price_draw ? Number(row.price_draw) : null,
        bookmaker: row.bookmaker,
      },
      capturedAt: row.captured_at,
      chainHash: row.chain_hash,
      previousSnapshotId: row.previous_snapshot_id,
      createdAt: row.created_at,
      createdBy: row.created_by,
      schemaVersion: row.schema_version,
      correlationId: row.correlation_id,
    }));
  }

  async getOddsByPhase(
    fixtureId: string,
    market: LiveMarketKind,
    line: number,
    phase: OddsPhase
  ): Promise<OddsSnapshotRecordLV | null> {
    const { data } = await supabase
      .from('odds_snapshots')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('market', market)
      .eq('line', line)
      .eq('phase', phase)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return {
      id: data.id,
      fixtureId: data.fixture_id,
      phase: data.phase as OddsPhase,
      quote: {
        market: data.market as LiveMarketKind,
        line: Number(data.line),
        priceHome: Number(data.price_home),
        priceAway: Number(data.price_away),
        priceDraw: data.price_draw ? Number(data.price_draw) : null,
        bookmaker: data.bookmaker,
      },
      capturedAt: data.captured_at,
      chainHash: data.chain_hash,
      previousSnapshotId: data.previous_snapshot_id,
      createdAt: data.created_at,
      createdBy: data.created_by,
      schemaVersion: data.schema_version,
      correlationId: data.correlation_id,
    };
  }

  async getLastOddsSnapshot(fixtureId: string): Promise<OddsSnapshotRecordLV | null> {
    const { data } = await supabase
      .from('odds_snapshots')
      .select('*')
      .eq('fixture_id', fixtureId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return {
      id: data.id,
      fixtureId: data.fixture_id,
      phase: data.phase as OddsPhase,
      quote: {
        market: data.market as LiveMarketKind,
        line: Number(data.line),
        priceHome: Number(data.price_home),
        priceAway: Number(data.price_away),
        priceDraw: data.price_draw ? Number(data.price_draw) : null,
        bookmaker: data.bookmaker,
      },
      capturedAt: data.captured_at,
      chainHash: data.chain_hash,
      previousSnapshotId: data.previous_snapshot_id,
      createdAt: data.created_at,
      createdBy: data.created_by,
      schemaVersion: data.schema_version,
      correlationId: data.correlation_id,
    };
  }

  // ─── settlements ──────────────────────────────────────────────────────

  async appendSettlement(record: SettlementRecordLV): Promise<void> {
    const { error } = await supabase.from('settlements').insert({
      id: record.id,
      prediction_id: record.predictionId,
      fixture_id: record.fixtureId,
      league: record.league,
      market: record.market,
      selection: record.selection,
      line: record.line,
      stake: record.stake,
      odds_taken: record.oddsTaken,
      closing_odds: record.closingOdds,
      home_score: record.homeScore,
      away_score: record.awayScore,
      outcome: record.outcome,
      units_returned: record.unitsReturned,
      profit: record.profit,
      roi: record.roi,
      clv: record.clv,
      settled_at: record.settledAt,
      idempotency_key: record.idempotencyKey,
      created_at: record.createdAt,
      created_by: record.createdBy,
      schema_version: record.schemaVersion,
      correlation_id: record.correlationId,
    });

    if (error) {
      if (error.code === '23505') {
        throw new DuplicateRecordError('settlements', record.idempotencyKey);
      }
      throw new Error(`Failed to append settlement: ${error.message}`);
    }
  }

  async getSettlementByIdempotencyKey(key: string): Promise<SettlementRecordLV | null> {
    const { data } = await supabase
      .from('settlements')
      .select('*')
      .eq('idempotency_key', key)
      .maybeSingle();

    if (!data) return null;
    return this.mapSettlementRow(data);
  }

  async hasSettlementForPrediction(predictionId: string, market: LiveMarketKind): Promise<boolean> {
    const { data } = await supabase
      .from('settlements')
      .select('id')
      .eq('prediction_id', predictionId)
      .eq('market', market)
      .limit(1);

    return Array.isArray(data) && data.length > 0;
  }

  async listSettlements(filter?: { from?: string; to?: string; league?: string }): Promise<SettlementRecordLV[]> {
    let query = supabase.from('settlements').select('*').order('settled_at', { ascending: true });

    if (filter?.from) query = query.gte('settled_at', filter.from);
    if (filter?.to) query = query.lte('settled_at', filter.to);
    if (filter?.league) query = query.eq('league', filter.league);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(row => this.mapSettlementRow(row));
  }

  private mapSettlementRow(row: any): SettlementRecordLV {
    return {
      id: row.id,
      predictionId: row.prediction_id,
      fixtureId: row.fixture_id,
      league: row.league,
      market: row.market as LiveMarketKind,
      selection: row.selection,
      line: Number(row.line),
      stake: Number(row.stake),
      oddsTaken: Number(row.odds_taken),
      closingOdds: row.closing_odds ? Number(row.closing_odds) : null,
      homeScore: Number(row.home_score),
      awayScore: Number(row.away_score),
      outcome: row.outcome,
      unitsReturned: Number(row.units_returned),
      profit: Number(row.profit),
      roi: Number(row.roi),
      clv: row.clv ? Number(row.clv) : null,
      settledAt: row.settled_at,
      idempotencyKey: row.idempotency_key,
      createdAt: row.created_at,
      createdBy: row.created_by,
      schemaVersion: row.schema_version,
      correlationId: row.correlation_id,
    };
  }

  // ─── rolling_metrics ──────────────────────────────────────────────────

  async appendRollingMetrics(record: RollingMetricsRecord): Promise<void> {
    const { error } = await supabase.from('rolling_metrics').insert({
      id: record.id,
      as_of: record.asOf,
      window_days: record.windowDays,
      predictions: record.predictions,
      settled_bets: record.settledBets,
      roi: record.roi,
      yield: record.yield,
      hit_rate: record.hitRate,
      avg_odds: record.avgOdds,
      avg_expected_value: record.avgExpectedValue,
      avg_edge: record.avgEdge,
      avg_clv: record.avgClv,
      brier_score: record.brierScore,
      log_loss: record.logLoss,
      expected_goals_error: record.expectedGoalsError,
      max_drawdown: record.maxDrawdown,
      sharpe_ratio: record.sharpeRatio,
      kelly_efficiency: record.kellyEfficiency,
      calibration_error: record.calibrationError,
      total_profit: record.totalProfit,
      total_staked: record.totalStaked,
      edge_distribution: record.edgeDistribution,
      league_breakdown: record.leagueBreakdown,
      market_breakdown: record.marketBreakdown,
      confidence_breakdown: record.confidenceBreakdown,
      created_at: record.createdAt,
      created_by: record.createdBy,
      schema_version: record.schemaVersion,
      correlation_id: record.correlationId,
    });

    if (error) throw new Error(`Failed to append rolling metrics: ${error.message}`);
  }

  async getLatestRollingMetrics(windowDays: number): Promise<RollingMetricsRecord | null> {
    const { data } = await supabase
      .from('rolling_metrics')
      .select('*')
      .eq('window_days', windowDays)
      .order('as_of', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return this.mapRollingMetricsRow(data);
  }

  async listRollingMetrics(windowDays?: number): Promise<RollingMetricsRecord[]> {
    let query = supabase.from('rolling_metrics').select('*').order('as_of', { ascending: true });
    if (windowDays) query = query.eq('window_days', windowDays);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(row => this.mapRollingMetricsRow(row));
  }

  private mapRollingMetricsRow(row: any): RollingMetricsRecord {
    return {
      id: row.id,
      asOf: row.as_of,
      windowDays: Number(row.window_days) as any,
      predictions: Number(row.predictions),
      settledBets: Number(row.settled_bets),
      roi: Number(row.roi),
      yield: Number(row.yield),
      hitRate: Number(row.hit_rate),
      avgOdds: Number(row.avg_odds),
      avgExpectedValue: Number(row.avg_expected_value),
      avgEdge: Number(row.avg_edge),
      avgClv: row.avg_clv ? Number(row.avg_clv) : null,
      brierScore: row.brier_score ? Number(row.brier_score) : null,
      logLoss: row.log_loss ? Number(row.log_loss) : null,
      expectedGoalsError: row.expected_goals_error ? Number(row.expected_goals_error) : null,
      maxDrawdown: Number(row.max_drawdown),
      sharpeRatio: row.sharpe_ratio ? Number(row.sharpe_ratio) : null,
      kellyEfficiency: row.kelly_efficiency ? Number(row.kelly_efficiency) : null,
      calibrationError: row.calibration_error ? Number(row.calibration_error) : null,
      totalProfit: Number(row.total_profit),
      totalStaked: Number(row.total_staked),
      edgeDistribution: row.edge_distribution || [],
      leagueBreakdown: row.league_breakdown || {},
      marketBreakdown: row.market_breakdown || {},
      confidenceBreakdown: row.confidence_breakdown || {},
      createdAt: row.created_at,
      createdBy: row.created_by,
      schemaVersion: row.schema_version,
      correlationId: row.correlation_id,
    };
  }

  // ─── calibration_history ─────────────────────────────────────────────

  async appendCalibrationRecord(record: CalibrationHistoryRecord): Promise<void> {
    const { error } = await supabase.from('calibration_history').insert({
      id: record.id,
      as_of: record.asOf,
      window_days: record.windowDays,
      sample_size: record.sampleSize,
      ece: record.ece,
      mce: record.mce,
      buckets: record.buckets,
      ece_drift: record.eceDrift,
      created_at: record.createdAt,
      created_by: record.createdBy,
      schema_version: record.schemaVersion,
      correlation_id: record.correlationId,
    });

    if (error) throw new Error(`Failed to append calibration record: ${error.message}`);
  }

  async getLatestCalibration(): Promise<CalibrationHistoryRecord | null> {
    const { data } = await supabase
      .from('calibration_history')
      .select('*')
      .order('as_of', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return {
      id: data.id,
      asOf: data.as_of,
      windowDays: Number(data.window_days),
      sampleSize: Number(data.sample_size),
      ece: Number(data.ece),
      mce: Number(data.mce),
      buckets: data.buckets || [],
      eceDrift: data.ece_drift ? Number(data.ece_drift) : null,
      createdAt: data.created_at,
      createdBy: data.created_by,
      schemaVersion: data.schema_version,
      correlationId: data.correlation_id,
    };
  }

  async listCalibrationHistory(): Promise<CalibrationHistoryRecord[]> {
    const { data, error } = await supabase
      .from('calibration_history')
      .select('*')
      .order('as_of', { ascending: true });

    if (error || !data) return [];
    return data.map(row => ({
      id: row.id,
      asOf: row.as_of,
      windowDays: Number(row.window_days),
      sampleSize: Number(row.sample_size),
      ece: Number(row.ece),
      mce: Number(row.mce),
      buckets: row.buckets || [],
      eceDrift: row.ece_drift ? Number(row.ece_drift) : null,
      createdAt: row.created_at,
      createdBy: row.created_by,
      schemaVersion: row.schema_version,
      correlationId: row.correlation_id,
    }));
  }

  // ─── drift_events ────────────────────────────────────────────────────

  async appendDriftEvent(record: DriftEventRecord): Promise<void> {
    const { error } = await supabase.from('drift_events').insert({
      id: record.id,
      as_of: record.asOf,
      dimension: record.dimension,
      metric: record.metric,
      psi: record.psi,
      severity: record.severity,
      reference_window_days: record.referenceWindowDays,
      current_window_days: record.currentWindowDays,
      reference_sample_size: record.referenceSampleSize,
      current_sample_size: record.currentSampleSize,
      detail: record.detail,
      created_at: record.createdAt,
      created_by: record.createdBy,
      schema_version: record.schemaVersion,
      correlation_id: record.correlationId,
    });

    if (error) throw new Error(`Failed to append drift event: ${error.message}`);
  }

  async listDriftEvents(filter?: { from?: string; to?: string }): Promise<DriftEventRecord[]> {
    let query = supabase.from('drift_events').select('*').order('as_of', { ascending: true });

    if (filter?.from) query = query.gte('as_of', filter.from);
    if (filter?.to) query = query.lte('as_of', filter.to);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(row => ({
      id: row.id,
      asOf: row.as_of,
      dimension: row.dimension,
      metric: row.metric,
      psi: Number(row.psi),
      severity: row.severity,
      referenceWindowDays: Number(row.reference_window_days),
      currentWindowDays: Number(row.current_window_days),
      referenceSampleSize: Number(row.reference_sample_size),
      currentSampleSize: Number(row.current_sample_size),
      detail: row.detail,
      createdAt: row.created_at,
      createdBy: row.created_by,
      schemaVersion: row.schema_version,
      correlationId: row.correlation_id,
    }));
  }

  // ─── alert_history ───────────────────────────────────────────────────

  async appendAlert(record: AlertRecord): Promise<void> {
    const { error } = await supabase.from('alert_history').insert({
      id: record.id,
      rule: record.rule,
      severity: record.severity,
      title: record.title,
      message: record.message,
      metric: record.metric,
      val: record.value,
      threshold: record.threshold,
      channels_notified: record.channelsNotified,
      fired_at: record.firedAt,
      created_at: record.createdAt,
      created_by: record.createdBy,
      schema_version: record.schemaVersion,
      correlation_id: record.correlationId,
    });

    if (error) throw new Error(`Failed to append alert: ${error.message}`);
  }

  async listAlerts(filter?: { from?: string; to?: string; rule?: string }): Promise<AlertRecord[]> {
    let query = supabase.from('alert_history').select('*').order('fired_at', { ascending: true });

    if (filter?.from) query = query.gte('fired_at', filter.from);
    if (filter?.to) query = query.lte('fired_at', filter.to);
    if (filter?.rule) query = query.eq('rule', filter.rule);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(row => ({
      id: row.id,
      rule: row.rule,
      severity: row.severity,
      title: row.title,
      message: row.message,
      metric: row.metric,
      value: row.val ? Number(row.val) : null,
      threshold: row.threshold ? Number(row.threshold) : null,
      channelsNotified: row.channels_notified || [],
      firedAt: row.fired_at,
      createdAt: row.created_at,
      createdBy: row.created_by,
      schemaVersion: row.schema_version,
      correlationId: row.correlation_id,
    }));
  }

  // ─── weekly_reports ──────────────────────────────────────────────────

  async appendWeeklyReport(record: WeeklyReportRecord): Promise<void> {
    const { error } = await supabase.from('weekly_reports').insert({
      id: record.id,
      week_start: record.weekStart,
      week_end: record.weekEnd,
      summary: record.summary,
      confidence_distribution: record.confidenceDistribution,
      league_comparison: record.leagueComparison,
      market_comparison: record.marketComparison,
      best_cases: record.bestCases,
      worst_cases: record.worstCases,
      model_stability: record.modelStability,
      recommendations: record.recommendations,
      markdown: record.markdown,
      created_at: record.createdAt,
      created_by: record.createdBy,
      schema_version: record.schemaVersion,
      correlation_id: record.correlationId,
    });

    if (error) throw new Error(`Failed to append weekly report: ${error.message}`);
  }

  async listWeeklyReports(): Promise<WeeklyReportRecord[]> {
    const { data, error } = await supabase
      .from('weekly_reports')
      .select('*')
      .order('week_start', { ascending: false });

    if (error || !data) return [];
    return data.map(row => ({
      id: row.id,
      weekStart: row.week_start,
      weekEnd: row.week_end,
      summary: row.summary,
      confidenceDistribution: row.confidence_distribution,
      leagueComparison: row.league_comparison,
      marketComparison: row.market_comparison,
      bestCases: row.best_cases,
      worstCases: row.worst_cases,
      modelStability: row.model_stability,
      recommendations: row.recommendations,
      markdown: row.markdown,
      createdAt: row.created_at,
      createdBy: row.created_by,
      schemaVersion: row.schema_version,
      correlationId: row.correlation_id,
    }));
  }
}
