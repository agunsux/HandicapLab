// HandicapLab Event Queue & Event Broker System
// Location: src/lib/paper-trading/eventSystem.ts

import crypto from 'crypto';
import { PredictionWorker } from './predictionWorker';
import { ResultReconciler } from './resultReconciler';
import type { JobRecord, EventCallback } from './types';

export class EventQueue {
  private static jobs: Map<string, JobRecord> = new Map();
  private static listeners: Map<string, EventCallback[]> = new Map();
  private static processedKeys: Set<string> = new Set(); // For memory idempotency checks
  private static isInitialized = false;

  /**
   * Registers a listener callback for a specific event type.
   */
  public static subscribe(eventType: string, callback: EventCallback): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * Initializes default subscribers.
   */
  public static init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    
    // Subscribe workers to event channels
    this.subscribe('fixture.created', PredictionWorker.handleFixtureEvent);
    this.subscribe('fixture.kickoff_soon', PredictionWorker.handleFixtureEvent);
    this.subscribe('match.finished', ResultReconciler.handleMatchFinished);

    console.log('[EventQueue] Event subscribers successfully initialized.');
  }

  /**
   * Publishes / inserts a new event job to the queue.
   * Enforces idempotency via idempotency_key.
   */
  public static async publish(
    eventType: JobRecord['event_type'],
    payload: any,
    idempotencyKey: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<JobRecord> {
    this.init(); // Auto-init on first publish

    // 1. Idempotency Check
    if (this.processedKeys.has(idempotencyKey)) {
      const existingJob = Array.from(this.jobs.values()).find(
        (j) => j.idempotency_key === idempotencyKey
      );
      if (existingJob) {
        console.log(`[EventQueue] Idempotent hit for key: ${idempotencyKey}. Reusing job ID: ${existingJob.id}`);
        return existingJob;
      }
    }

    const job: JobRecord = {
      id: crypto.randomUUID(),
      event_type: eventType,
      created_at: new Date().toISOString(),
      retry_count: 0,
      status: 'pending',
      payload,
      idempotency_key: idempotencyKey,
      correlation_id: correlationId
    };

    this.jobs.set(job.id, job);
    this.processedKeys.add(idempotencyKey);

    console.log(
      `[EventQueue] Event published: ${eventType} | Job ID: ${job.id} | Correlation ID: ${correlationId}`
    );

    // Trigger process asynchronously
    this.processJob(job.id).catch((err) => {
      console.error(`[EventQueue] Failed process job ${job.id}:`, err);
    });

    return job;
  }

  /**
   * Returns a job by its UUID.
   */
  public static getJob(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }

  /**
   * Returns all registered jobs.
   */
  public static getJobs(): JobRecord[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Clears the event broker (primarily for testing).
   */
  public static clear(): void {
    this.jobs.clear();
    this.listeners.clear();
    this.processedKeys.clear();
    this.isInitialized = false;
  }

  /**
   * Background process loop for a single job execution.
   */
  private static async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'pending') return;

    job.status = 'processing';
    const startTime = Date.now();

    console.log(
      `[EventQueue] Processing job ${job.id} | Type: ${job.event_type} | Correlation ID: ${job.correlation_id}`
    );

    const callbacks = this.listeners.get(job.event_type) || [];
    
    try {
      for (const callback of callbacks) {
        await callback(job);
      }
      job.status = 'completed';
      const elapsed = Date.now() - startTime;
      console.log(
        `[EventQueue] Job completed successfully: ${job.id} | Time elapsed: ${elapsed}ms`
      );
    } catch (err: any) {
      job.retry_count += 1;
      job.error_message = err.message || String(err);
      
      const maxRetries = 3;
      if (job.retry_count <= maxRetries) {
        job.status = 'pending';
        console.warn(
          `[EventQueue] Job failed: ${job.id} | Error: ${job.error_message}. Retrying (${job.retry_count}/${maxRetries}) in 100ms...`
        );
        // Exponential retry backoff simulation
        setTimeout(() => {
          this.processJob(jobId).catch(console.error);
        }, 100);
      } else {
        job.status = 'failed';
        console.error(
          `[EventQueue] Job permanently failed: ${job.id} | Retries exhausted. Error: ${job.error_message}`
        );
      }
    }
  }
}
