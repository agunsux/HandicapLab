import { supabase } from '@/lib/supabase.server';

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
        .from('cron_runs')
        .insert({
          cron_name: cronName,
          start_time: startTime,
          records_processed: 0
        })
        .select('id')
        .single();

      if (error) {
        console.error(`[CronLogger] Failed to start log for ${cronName}:`, error);
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
        .from('cron_runs')
        .update({
          end_time: endTime,
          records_processed: recordsProcessed,
          errors: sanitizedError
        })
        .eq('id', logId);

      if (error) {
        console.error(`[CronLogger] Failed to end log for logId ${logId}:`, error);
      }
    } catch (err) {
      console.error(`[CronLogger] Exception ending log for logId ${logId}:`, err);
    }
  }
}
