import { HealthSnapshot, DriftReport, DriftMetricDetail, DriftSeverity } from './types';

/**
 * Layer 3: Drift Detector
 *
 * Two types of drift, as per product spec:
 *
 * 1. Operational Drift — current vs last 24h / 7d snapshots
 *    Detects fast-moving degradation: today's model vs yesterday.
 *
 * 2. Structural Drift — current vs Golden Baseline (approved artifact)
 *    Detects slow, cumulative decay that rolling windows miss.
 */

interface ThresholdConfig {
  warning: number;
  critical: number;
  direction: 'higher_is_worse' | 'lower_is_worse';
}

const THRESHOLDS: Record<string, ThresholdConfig> = {
  brierScore:           { warning: 0.03, critical: 0.06, direction: 'higher_is_worse' },
  ece:                  { warning: 0.03, critical: 0.06, direction: 'higher_is_worse' },
  winRate:              { warning: 0.04, critical: 0.08, direction: 'lower_is_worse' },
  decisionAccuracy:     { warning: 0.05, critical: 0.10, direction: 'lower_is_worse' },
  missedOpportunityRate:{ warning: 0.05, critical: 0.10, direction: 'higher_is_worse' },
  avgConfidence:        { warning: 0.05, critical: 0.10, direction: 'lower_is_worse' },
  dataQualityScore:     { warning: 0.05, critical: 0.10, direction: 'lower_is_worse' },
};

const MONITORED_METRICS: (keyof HealthSnapshot)[] = [
  'brierScore',
  'ece',
  'winRate',
  'decisionAccuracy',
  'missedOpportunityRate',
  'avgConfidence',
  'dataQualityScore',
];

function compareMetric(metric: string, baseline: number, current: number): DriftMetricDetail {
  const delta = current - baseline;
  const pctChange = baseline !== 0 ? Math.abs(delta / baseline) : 0;
  const cfg = THRESHOLDS[metric];

  let severity: DriftSeverity = 'ok';
  if (cfg) {
    const magnitude = cfg.direction === 'higher_is_worse' ? delta : -delta;
    if (magnitude > cfg.critical) severity = 'critical';
    else if (magnitude > cfg.warning) severity = 'warning';
  }

  return { metric, baseline, current, delta, pctChange, severity };
}

function worstSeverity(details: DriftMetricDetail[]): DriftSeverity {
  if (details.some(d => d.severity === 'critical')) return 'critical';
  if (details.some(d => d.severity === 'warning')) return 'warning';
  return 'ok';
}

export class DriftDetector {
  /**
   * Compares current snapshot against two references:
   * @param current      The latest HealthSnapshot
   * @param operational  Previous 24h (or 7d) snapshot
   * @param golden       The approved golden baseline snapshot
   * @param goldenVersion  The version string of the golden baseline used
   */
  static detect(
    current: HealthSnapshot,
    operational: HealthSnapshot | null,
    golden: HealthSnapshot | null,
    goldenVersion: string = 'unknown'
  ): DriftReport {
    // Operational drift
    const opDetails: DriftMetricDetail[] = operational
      ? MONITORED_METRICS.map((m) => compareMetric(m as string, operational[m] as number, current[m] as number))
      : [];

    const opDrift = opDetails.filter(d => d.severity !== 'ok');

    // Structural drift
    const strDetails: DriftMetricDetail[] = golden
      ? MONITORED_METRICS.map((m) => compareMetric(m as string, golden[m] as number, current[m] as number))
      : [];

    const strDrift = strDetails.filter(d => d.severity !== 'ok');

    const opSeverity = worstSeverity(opDrift);
    const strSeverity = worstSeverity(strDrift);

    const overallSeverity: DriftSeverity =
      opSeverity === 'critical' || strSeverity === 'critical' ? 'critical'
      : opSeverity === 'warning' || strSeverity === 'warning' ? 'warning'
      : 'ok';

    return {
      operationalDrift: {
        isDrifted: opDrift.length > 0,
        details: opDrift,
        severity: opSeverity,
      },
      structuralDrift: {
        isDrifted: strDrift.length > 0,
        baselineVersion: goldenVersion,
        details: strDrift,
        severity: strSeverity,
      },
      overallSeverity,
    };
  }
}
