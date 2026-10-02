import { supabase } from '@/lib/supabase.server';

/**
 * Cron / job-run observability.
 *
 * IMPORTANT (production state recovery, 2026-10-02):
 * The legacy `cron_runs` table does NOT exist in production (HTTP 404 /
 * PGRST205) and the only migration definition of it uses a different column
 * set. Cron execution was therefore completely unobservable — `start()`
 * silently returned null.
 *
 * This logger now writes to the existing `live_validation_job_runs` table,
 * which is purpose-built for job-run records:
 *   job_name, status, started_at, finished_at, duration_ms,
 *   items_discovered, items_processed, items_failed, error_message,
 *   correlation_id
 */
export const CRON_RUN_TABLE = 'live_validation_job_runs';

export interface CronRunLog {
  id?: string;
  cron_name: string;
  start_time: string;
  end_time?: string;
  records_processed?: number;
  errors?: string | null;
}

export function sanitizeAndCategorizeError(error: any): string {
  if (!error) return 'UNKNOWN_FATAL_ERROR';
  const msg = String(error.message || error).toLowerCase();

  if (
    msg.includes('quota') ||
    msg.includes('limit') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('exceeded')
  ) {
    return 'API_QUOTA_EXCEEDED';
  }
  if (
    msg.includes('timeout') ||
    msg.includes('timedout') ||
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('fetch') ||
    msg.includes('econn') ||
    msg.includes('etimedout') ||
    msg.includes('refused')
  ) {
    return 'NETWORK_TIMEOUT';
  }
  if (
    msg.includes('unauthorized') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('forbidden') ||
    msg.includes('invalid key') ||
    msg.includes('auth') ||
    msg.includes('secret')
  ) {
    return 'UNAUTHORIZED_API_ACCESS';
  }
  if (
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('server error') ||
    msg.includes('bad gateway')
  ) {
    return 'PROVIDER_SERVER_ERROR';
  }
  if (
    msg.includes('db') ||
    msg.includes('database') ||
    msg.includes('postgres') ||
    msg.includes('supabase') ||
    msg.includes('relation') ||
    msg.includes('constraint') ||
    msg.includes('foreign key') ||
    msg.includes('insert') ||
    msg.includes('update') ||
    msg.includes('row-level security') ||
    msg.includes('rls')
  ) {
    return 'DATABASE_OPERATION_ERROR';
  }
  if (
    msg.includes('validation') ||
    msg.includes('parse') ||
    msg.includes('schema') ||
    msg.includes('null') ||
    msg.includes('expected') ||
    msg.includes('invalid input') ||
    msg.includes('format')
  ) {
    return 'DATA_VALIDATION_ERROR';
  }

  return 'UNKNOWN_FATAL_ERROR';
}

export class CronLogger {
  static async start(cronName: string): Promise<string | null> {
    try {
      const startTime = new Date().toISOString();
      const { data, error } = await supabase
        .from(CRON_RUN_TABLE)
        .insert({
          job_name: cronName,
          status: 'RUNNING',
          started_at: startTime,
          correlation_id: `${cronName}:${startTime}`,
          items_discovered: 0,
          items_processed: 0,
          items_failed: 0,
        })
        .select('id')
        .single();

      if (error) {
        console.error(`[CronLogger] Failed to start log for ${cronName}:`, error.message);
        return null;
      }
      return data?.id || null;
    } catch (err) {
      console.error(`[CronLogger] Exception starting log for ${cronName}:`, err);
      return null;
    }
  }

  static async end(
    logId: string | null,
    recordsProcessed: number,
    errors: any = null
  ): Promise<void> {
    if (!logId) return;
    try {
      const endTime = new Date().toISOString();
      const sanitizedError = errors ? sanitizeAndCategorizeError(errors) : null;
      const { error } = await supabase
        .from(CRON_RUN_TABLE)
        .update({
          status: sanitizedError ? 'FAILED' : 'SUCCESS',
          finished_at: endTime,
          items_processed: recordsProcessed,
          items_failed: sanitizedError ? 1 : 0,
          error_message: sanitizedError,
        })
        .eq('id', logId);

      if (error) {
        console.error(`[CronLogger] Failed to end log for logId ${logId}:`, error.message);
      }
    } catch (err) {
      console.error(`[CronLogger] Exception ending log for logId ${logId}:`, err);
    }
  }

  public static async getCronMetrics(cronName: string): Promise<{
    failureCount: number;
    lastSuccessfulRun: string | null;
    recentRuns: any[];
  }> {
    const { data: runs } = await supabase
      .from(CRON_RUN_TABLE)
      .select('*')
      .eq('job_name', cronName)
      .order('started_at', { ascending: false });

    const recentRuns = (runs || []).map((r: any) => {
      const started = new Date(r.started_at).getTime();
      const finished = r.finished_at ? new Date(r.finished_at).getTime() : null;
      const duration = finished ? (finished - started) / 1000 : 0;
      return {
        run_id: r.correlation_id || r.id,
        started_at: r.started_at,
        finished_at: r.finished_at || null,
        duration,
        status:
          r.status === 'FAILED'
            ? 'failed'
            : r.status === 'SUCCESS'
              ? 'success'
              : 'running',
        error_message: r.error_message || null,
      };
    });

    const failureCount = recentRuns.filter((r) => r.status === 'failed').length;
    const successRun = recentRuns.find((r) => r.status === 'success');
    const lastSuccessfulRun = successRun ? successRun.started_at : null;

    return {
      failureCount,
      lastSuccessfulRun,
      recentRuns
    };
  }
}
