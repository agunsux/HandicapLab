import type { ReplayMetrics } from '../../lib/epic31b/types';

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface ExperimentJob {
  jobId: string;
  experimentId: string;
  status: JobStatus;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface ComparisonReport {
  baseExperimentId: string;
  candidateExperimentId: string;
  deltaROI: number;
  deltaCLV: number;
  deltaECE: number;
  deltaLogLoss: number;
  deltaRuntimeMs: number;
}

export class ExperimentScheduler {
  private queue: Map<string, ExperimentJob> = new Map();

  /**
   * Schedules a new validation job in the execution queue.
   */
  public scheduleJob(experimentId: string): ExperimentJob {
    const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const job: ExperimentJob = {
      jobId,
      experimentId,
      status: 'PENDING',
      scheduledAt: new Date().toISOString(),
    };
    this.queue.set(jobId, job);
    return job;
  }

  /**
   * Promotes a job status in the research workflow queue.
   */
  public updateJobStatus(jobId: string, status: JobStatus, error?: string): void {
    const job = this.queue.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found.`);
    job.status = status;
    if (status === 'RUNNING') {
      job.startedAt = new Date().toISOString();
    } else if (status === 'COMPLETED' || status === 'FAILED') {
      job.completedAt = new Date().toISOString();
      if (error) job.error = error;
    }
  }

  public getQueue(): ExperimentJob[] {
    return Array.from(this.queue.values());
  }

  /**
   * Compares the delta statistics of two validation experiments.
   */
  public static compare(
    baseId: string,
    baseMetrics: ReplayMetrics,
    baseDurationMs: number,
    candidateId: string,
    candidateMetrics: ReplayMetrics,
    candidateDurationMs: number
  ): ComparisonReport {
    return {
      baseExperimentId: baseId,
      candidateExperimentId: candidateId,
      deltaROI: Math.round((candidateMetrics.roi - baseMetrics.roi) * 100) / 100,
      deltaCLV: Math.round((candidateMetrics.avgClv - baseMetrics.avgClv) * 10000) / 10000,
      deltaECE: Math.round((candidateMetrics.ece - baseMetrics.ece) * 10000) / 10000,
      deltaLogLoss: Math.round((candidateMetrics.logLoss - baseMetrics.logLoss) * 10000) / 10000,
      deltaRuntimeMs: candidateDurationMs - baseDurationMs,
    };
  }
}
