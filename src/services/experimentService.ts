// Experiment Framework routing service
// Location: src/services/experimentService.ts

import { supabase } from '../lib/supabase.server';
import crypto from 'crypto';

export class ExperimentService {
  /**
   * Routes a match/request to an experiment bucket.
   * Bucket = Hash(routingKey) % K
   */
  public static getBucket(
    experimentId: string,
    routingKey: string,
    buckets = ['A', 'B']
  ): string {
    const hash = crypto.createHash('md5').update(`${experimentId}_${routingKey}`).digest('hex');
    const hashVal = parseInt(hash.substring(0, 8), 16);
    const index = hashVal % buckets.length;
    return buckets[index];
  }

  /**
   * Logs a performance outcome to an experiment bucket.
   */
  public static async recordOutcome(
    experimentId: string,
    bucket: string,
    metrics: { brierContribution: number; eceContribution: number; profitLoss: number }
  ): Promise<boolean> {
    try {
      // Get current metrics
      const { data, error } = await supabase
        .from('experiment_metrics')
        .select('*')
        .eq('experiment_id', experimentId)
        .eq('bucket', bucket)
        .maybeSingle();

      if (error) {
        console.error('[ExperimentService] Fetch metrics error:', error.message);
        return false;
      }

      const sampleSize = (data?.sample_size || 0) + 1;
      const priorBrier = data?.brier_score || 0.0;
      const priorECE = data?.ece || 0.0;
      const priorROI = data?.roi || 0.0;

      // Incremental mean updates
      const updatedBrier = priorBrier + (metrics.brierContribution - priorBrier) / sampleSize;
      const updatedECE = priorECE + (metrics.eceContribution - priorECE) / sampleSize;
      const updatedROI = priorROI + (metrics.profitLoss - priorROI) / sampleSize;

      const { error: upsertErr } = await supabase
        .from('experiment_metrics')
        .upsert({
          experiment_id: experimentId,
          bucket,
          sample_size: sampleSize,
          brier_score: Number(updatedBrier.toFixed(6)),
          ece: Number(updatedECE.toFixed(6)),
          roi: Number(updatedROI.toFixed(6)),
          updated_at: new Date().toISOString()
        });

      if (upsertErr) {
        console.error('[ExperimentService] Record outcome error:', upsertErr.message);
        return false;
      }
      return true;
    } catch (e: any) {
      console.error('[ExperimentService] recordOutcome exception:', e.message);
      return false;
    }
  }
}
