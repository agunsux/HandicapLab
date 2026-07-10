// Shared types for paper-trading module
// Extracted to break circular dependency: eventSystem ↔ predictionWorker/resultReconciler

export interface JobRecord {
  id: string;
  event_type: 'fixture.created' | 'fixture.updated' | 'fixture.kickoff_soon' | 'match.finished';
  created_at: string;
  retry_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: any;
  idempotency_key: string;
  error_message?: string;
  correlation_id: string;
}

export type EventCallback = (job: JobRecord) => Promise<void>;