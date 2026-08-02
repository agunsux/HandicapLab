export type ProviderErrorCode = 
  | 'AUTH_ERROR' 
  | 'QUOTA_EXCEEDED' 
  | 'RATE_LIMITED' 
  | 'NETWORK_ERROR' 
  | 'INVALID_RESPONSE' 
  | 'NO_DATA' 
  | 'STALE_DATA';

export interface ProviderTelemetry {
  provider: string;
  pipeline_run_id: string;
  executionMode: 'REPLAY' | 'REAL_PROVIDER_RUN';
  requests_consumed: number;
  requests_failed: number;
  remaining_budget?: number | null;
  error?: ProviderErrorCode;
}

export class ProviderTelemetryLogger {
  static log(telemetry: ProviderTelemetry): void {
    console.log(`[Telemetry][Provider] ${telemetry.provider} - Run: ${telemetry.pipeline_run_id}`);
    console.log(`  Mode: ${telemetry.executionMode}`);
    console.log(`  Requests Consumed: ${telemetry.requests_consumed}`);
    console.log(`  Requests Failed: ${telemetry.requests_failed}`);
    if (telemetry.remaining_budget !== undefined) {
      console.log(`  Remaining Budget: ${telemetry.remaining_budget}`);
    }
    if (telemetry.error) {
      console.log(`  Error: ${telemetry.error}`);
    }
  }
}
