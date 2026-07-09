// Model Registry Repository
// Location: src/lib/data/modelRegistryRepository.ts

import { supabase } from '../supabase.server';

export interface ModelRegistryRecord {
  id?: string;
  model_id: string;
  version: string;
  description?: string;
  role: 'champion' | 'challenger' | 'shadow' | 'retired';
  parameters: Record<string, unknown>;
  performance_metrics?: Record<string, unknown>;
}

export class ModelRegistryRepository {
  /**
   * Retrieves the Champion model record.
   */
  public static async getChampionModel(): Promise<ModelRegistryRecord | null> {
    const { data, error } = await supabase
      .from('model_registry')
      .select('*')
      .eq('role', 'champion')
      .maybeSingle();

    if (error) {
      console.error('[ModelRegistryRepository] getChampionModel error:', error.message);
      return null;
    }
    return data;
  }

  /**
   * Retrieves all Challenger or Shadow model records.
   */
  public static async getActiveModels(): Promise<ModelRegistryRecord[]> {
    const { data, error } = await supabase
      .from('model_registry')
      .select('*')
      .in('role', ['champion', 'challenger', 'shadow']);

    if (error) {
      console.error('[ModelRegistryRepository] getActiveModels error:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Updates performance metrics of a model.
   */
  public static async updatePerformanceMetrics(
    modelId: string,
    metrics: { brier: number; ece: number; roi: number; sharpe: number }
  ): Promise<boolean> {
    const { error } = await supabase
      .from('model_registry')
      .update({
        performance_metrics: metrics,
        updated_at: new Date().toISOString()
      })
      .eq('model_id', modelId);

    if (error) {
      console.error('[ModelRegistryRepository] updatePerformanceMetrics error:', error.message);
      return false;
    }
    return true;
  }

  /**
   * Updates the role of a model (e.g. promoting Challenger to Champion).
   */
  public static async updateModelRole(
    modelId: string,
    role: 'champion' | 'challenger' | 'shadow' | 'retired'
  ): Promise<boolean> {
    // If promoting to champion, demote the current champion to challenger
    if (role === 'champion') {
      const { error: demoteErr } = await supabase
        .from('model_registry')
        .update({ role: 'challenger', updated_at: new Date().toISOString() })
        .eq('role', 'champion');

      if (demoteErr) {
        console.error('[ModelRegistryRepository] Demoting current champion error:', demoteErr.message);
        return false;
      }
    }

    const { error } = await supabase
      .from('model_registry')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('model_id', modelId);

    if (error) {
      console.error('[ModelRegistryRepository] updateModelRole error:', error.message);
      return false;
    }
    return true;
  }
}
