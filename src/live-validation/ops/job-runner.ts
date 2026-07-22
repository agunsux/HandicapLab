// EPIC 35.11 — Production Automation & Job Infrastructure
// Manages background cron execution logging, status tracking, Dead Letter Queue (DLQ)
// escalation, and scheduler health heartbeats.

import * as crypto from 'crypto';
import { supabase } from '../../lib/supabase.server';

export type JobName = 'scheduler' | 'settlement' | 'metrics' | 'archive';
export type JobStatus = 'running' | 'succeeded' | 'failed' | 'skipped';

export interface JobRunRecord {
  id: string;
  jobName: JobName;
  status: JobStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  itemsDiscovered: number;
  itemsProcessed: number;
  itemsFailed: number;
  errorMessage: string | null;
  correlationId: string;
}

export interface DlqRecord {
  id: string;
  jobName: string;
  entityType: 'fixture' | 'prediction' | 'settlement';
  entityId: string;
  errorCode: string;
  errorMessage: string;
  stackTrace: string | null;
  payload: Record<string, any>;
  retryCount: number;
  resolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  correlationId: string;
}

export class JobRunner {
  /** Log start of a cron job run */
  static async startRun(jobName: JobName, correlationId: string): Promise<JobRunRecord> {
    const record: JobRunRecord = {
      id: crypto.randomUUID(),
      jobName,
      status: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      durationMs: null,
      itemsDiscovered: 0,
      itemsProcessed: 0,
      itemsFailed: 0,
      errorMessage: null,
      correlationId,
    };

    try {
      await supabase.from('live_validation_job_runs').insert({
        id: record.id,
        job_name: record.jobName,
        status: record.status,
        started_at: record.startedAt,
        correlation_id: record.correlationId,
      });
    } catch (e) {
      // In local/offline mode, fallback safely
    }

    return record;
  }

  /** Complete a job run record with metrics */
  static async finishRun(
    runRecord: JobRunRecord,
    details: {
      status: JobStatus;
      itemsDiscovered?: number;
      itemsProcessed?: number;
      itemsFailed?: number;
      errorMessage?: string | null;
    }
  ): Promise<JobRunRecord> {
    const finishedAt = new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(runRecord.startedAt).getTime();

    const updated: JobRunRecord = {
      ...runRecord,
      status: details.status,
      finishedAt,
      durationMs,
      itemsDiscovered: details.itemsDiscovered ?? runRecord.itemsDiscovered,
      itemsProcessed: details.itemsProcessed ?? runRecord.itemsProcessed,
      itemsFailed: details.itemsFailed ?? runRecord.itemsFailed,
      errorMessage: details.errorMessage ?? null,
    };

    try {
      await supabase.from('live_validation_job_runs').update({
        status: updated.status,
        finished_at: updated.finishedAt,
        duration_ms: updated.durationMs,
        items_discovered: updated.itemsDiscovered,
        items_processed: updated.itemsProcessed,
        items_failed: updated.itemsFailed,
        error_message: updated.errorMessage,
      }).eq('id', updated.id);
    } catch (e) {
      // Offline fallback
    }

    return updated;
  }

  /** Log an unrecoverable failure to Dead Letter Queue (DLQ) */
  static async pushToDlq(input: {
    jobName: string;
    entityType: 'fixture' | 'prediction' | 'settlement';
    entityId: string;
    errorCode: string;
    errorMessage: string;
    stackTrace?: string;
    payload?: Record<string, any>;
    correlationId: string;
  }): Promise<DlqRecord> {
    const record: DlqRecord = {
      id: crypto.randomUUID(),
      jobName: input.jobName,
      entityType: input.entityType,
      entityId: input.entityId,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      stackTrace: input.stackTrace ?? null,
      payload: input.payload ?? {},
      retryCount: 0,
      resolved: false,
      resolvedAt: null,
      createdAt: new Date().toISOString(),
      correlationId: input.correlationId,
    };

    try {
      await supabase.from('live_validation_dlq').insert({
        id: record.id,
        job_name: record.jobName,
        entity_type: record.entityType,
        entity_id: record.entityId,
        error_code: record.errorCode,
        error_message: record.errorMessage,
        stack_trace: record.stackTrace,
        payload: record.payload,
        correlation_id: record.correlationId,
        created_at: record.createdAt,
      });
    } catch (e) {
      // Offline fallback
    }

    return record;
  }

  /** Check scheduler execution health: returns warning if last successful run > 2 hours ago */
  static async getOperationalHealth(): Promise<{
    healthy: boolean;
    lastSchedulerRun: string | null;
    lastSettlementRun: string | null;
    dlqPendingCount: number;
    staleScheduler: boolean;
  }> {
    let lastSchedulerRun: string | null = null;
    let lastSettlementRun: string | null = null;
    let dlqPendingCount = 0;

    try {
      const { data: schedData } = await supabase
        .from('live_validation_job_runs')
        .select('started_at')
        .eq('job_name', 'scheduler')
        .eq('status', 'succeeded')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (schedData) lastSchedulerRun = schedData.started_at;

      const { data: setData } = await supabase
        .from('live_validation_job_runs')
        .select('started_at')
        .eq('job_name', 'settlement')
        .eq('status', 'succeeded')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (setData) lastSettlementRun = setData.started_at;

      const { count } = await supabase
        .from('live_validation_dlq')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false);

      dlqPendingCount = count || 0;
    } catch (e) {
      // Offline fallback defaults
    }

    const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
    const staleScheduler = !lastSchedulerRun || new Date(lastSchedulerRun).getTime() < twoHoursAgo;

    return {
      healthy: !staleScheduler && dlqPendingCount === 0,
      lastSchedulerRun,
      lastSettlementRun,
      dlqPendingCount,
      staleScheduler,
    };
  }
}
