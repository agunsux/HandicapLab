import { supabase } from '@/lib/supabase.server';

export interface HypothesisModel {
  id?: number;
  hypothesisId: string;
  title: string;
  description: string;
  category: string;
  researcher: string;
  status?: 'draft' | 'running' | 'completed' | 'validated' | 'rejected' | 'production' | 'archived';
  priority?: 'low' | 'medium' | 'high';
}

export interface ExperimentModel {
  id?: number;
  experimentId: string;
  hypothesisId: string;
  dataset: string;
  featureSet: string[];
  parameters: Record<string, any>;
  walkForwardSplit: string;
  roi?: number;
  sharpe?: number;
  maxDrawdown?: number;
  brierScore?: number;
  logLoss?: number;
  generatorVersion: string;
  gitCommit: string;
}

export class MetricsCalculator {
  /**
   * Calculates ROI and yield from betting outcomes.
   */
  public static calculateRoi(stakes: number[], returns: number[]): { roi: number; profitFactor: number } {
    const totalStaked = stakes.reduce((a, b) => a + b, 0);
    const totalReturned = returns.reduce((a, b) => a + b, 0);

    if (totalStaked === 0) return { roi: 0.0, profitFactor: 0.0 };

    const netProfit = totalReturned - totalStaked;
    const roi = (netProfit / totalStaked) * 100;
    
    // Profit factor = total wins / total losses
    let totalWins = 0;
    let totalLosses = 0;
    for (let i = 0; i < stakes.length; i++) {
      const net = returns[i] - stakes[i];
      if (net > 0) totalWins += net;
      else totalLosses += Math.abs(net);
    }
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins;

    return {
      roi: Number(roi.toFixed(2)),
      profitFactor: Number(profitFactor.toFixed(2))
    };
  }

  /**
   * Calculates implied Kelly stake percentage.
   */
  public static calculateKelly(odds: number, probability: number, fractional = 0.5): number {
    if (odds <= 1.0 || probability <= 0.0 || probability >= 1.0) return 0.0;
    // Kelly = (p * b - q) / b where b = odds - 1
    const b = odds - 1;
    const q = 1 - probability;
    const stake = (probability * b - q) / b;
    return Number((Math.max(0, stake) * fractional).toFixed(4));
  }
}

export class ResearchEngineService {
  /**
   * Registers a hypothesis.
   */
  public async registerHypothesis(model: HypothesisModel): Promise<HypothesisModel> {
    const payload = {
      hypothesis_id: model.hypothesisId,
      title: model.title,
      description: model.description,
      category: model.category,
      researcher: model.researcher,
      status: model.status || 'draft',
      priority: model.priority || 'medium',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('wh_hypotheses')
      .upsert(payload, { onConflict: 'hypothesis_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`[ResearchEngine] Hypothesis register failed: ${error.message}`);
    }

    return {
      id: Number(data.id),
      hypothesisId: data.hypothesis_id,
      title: data.title,
      description: data.description,
      category: data.category,
      researcher: data.researcher,
      status: data.status,
      priority: data.priority
    };
  }

  /**
   * Registers an experiment output mapping.
   */
  public async registerExperiment(model: ExperimentModel): Promise<ExperimentModel> {
    const payload = {
      experiment_id: model.experimentId,
      hypothesis_id: model.hypothesisId,
      dataset: model.dataset,
      feature_set: model.featureSet,
      parameters: model.parameters,
      walk_forward_split: model.walkForwardSplit,
      roi: model.roi || 0.0,
      sharpe: model.sharpe || 0.0,
      max_drawdown: model.maxDrawdown || 0.0,
      brier_score: model.brierScore || 0.0,
      log_loss: model.logLoss || 0.0,
      generator_version: model.generatorVersion,
      git_commit: model.gitCommit
    };

    const { data, error } = await supabase
      .from('wh_experiments')
      .upsert(payload, { onConflict: 'experiment_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`[ResearchEngine] Experiment register failed: ${error.message}`);
    }

    return {
      id: Number(data.id),
      experimentId: data.experiment_id,
      hypothesisId: data.hypothesis_id,
      dataset: data.dataset,
      featureSet: data.feature_set,
      parameters: data.parameters,
      walkForwardSplit: data.walk_forward_split,
      roi: Number(data.roi),
      sharpe: Number(data.sharpe),
      maxDrawdown: Number(data.max_drawdown),
      brierScore: Number(data.brier_score),
      logLoss: Number(data.log_loss),
      generatorVersion: data.generator_version,
      gitCommit: data.git_commit
    };
  }

  /**
   * Audits state changes in research lifecycles.
   */
  public async transitionStatus(
    hypothesisId: string,
    newStatus: HypothesisModel['status'],
    operator: string,
    reason: string
  ): Promise<void> {
    const { data: current } = await supabase
      .from('wh_hypotheses')
      .select('status')
      .eq('hypothesis_id', hypothesisId)
      .single();

    if (!current) throw new Error('Hypothesis not found');

    const { error: updateError } = await supabase
      .from('wh_hypotheses')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('hypothesis_id', hypothesisId);

    if (updateError) throw new Error(updateError.message);

    const auditPayload = {
      operator,
      action_type: 'STATUS_TRANSITION',
      target_id: hypothesisId,
      changes_json: { from: current.status, to: newStatus },
      reason
    };

    await supabase.from('wh_research_audit_logs').insert(auditPayload);
  }
}
