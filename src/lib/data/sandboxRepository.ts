// Quant Research Sandbox Repository
// Location: src/lib/data/sandboxRepository.ts

import { supabase } from '../supabase.server';

export interface SandboxHypothesisRecord {
  id?: string;
  hypothesis_code: string;
  title: string;
  description?: string;
  researcher: string;
  status: 'draft' | 'testing' | 'validated' | 'rejected';
}

export interface SandboxRunRecord {
  id?: string;
  hypothesis_code: string;
  backtest_parameters: any;
  brier_score: number;
  sharpe_ratio: number;
  roi: number;
  max_drawdown: number;
  git_commit?: string;
}

export class SandboxRepository {
  /**
   * Registers a new hypothesis.
   */
  public static async registerHypothesis(hypothesis: SandboxHypothesisRecord): Promise<boolean> {
    const { error } = await supabase.from('quant_sandbox_hypotheses').upsert({
      hypothesis_code: hypothesis.hypothesis_code,
      title: hypothesis.title,
      description: hypothesis.description,
      researcher: hypothesis.researcher,
      status: hypothesis.status
    });

    if (error) {
      console.error('[SandboxRepository] registerHypothesis error:', error.message);
      return false;
    }
    return true;
  }

  /**
   * Records a sandbox backtest run.
   */
  public static async recordSandboxRun(run: SandboxRunRecord): Promise<boolean> {
    const { error } = await supabase.from('quant_sandbox_runs').insert({
      hypothesis_code: run.hypothesis_code,
      backtest_parameters: run.backtest_parameters,
      brier_score: run.brier_score,
      sharpe_ratio: run.sharpe_ratio,
      roi: run.roi,
      max_drawdown: run.max_drawdown,
      git_commit: run.git_commit || null
    });

    if (error) {
      console.error('[SandboxRepository] recordSandboxRun error:', error.message);
      return false;
    }
    return true;
  }

  /**
   * Retrieves hypotheses.
   */
  public static async getHypotheses(): Promise<any[]> {
    const { data, error } = await supabase
      .from('quant_sandbox_hypotheses')
      .select(`
        *,
        quant_sandbox_runs (
          brier_score,
          sharpe_ratio,
          roi,
          max_drawdown,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SandboxRepository] getHypotheses error:', error.message);
      return [];
    }
    return data || [];
  }
}
