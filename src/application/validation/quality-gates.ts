import type { StatisticalValidatorOutput } from '../../lib/epic31b/types';

export interface QualityGateConfig {
  maxExpectedCalibrationError: number;
  maxDrawdownLimit: number;
  minimumExpectedValue: number;
  minimumRoi: number;
  requireClvPositive: boolean;
}

export interface QualityGateResult {
  passed: boolean;
  checks: Record<string, { passed: boolean; value: number | string; limit: number | string }>;
}

export class QualityGates {
  /**
   * Evaluates the validation results against configured thresholds.
   */
  public static evaluate(
    stats: StatisticalValidatorOutput,
    config: QualityGateConfig
  ): QualityGateResult {
    const checks: Record<string, { passed: boolean; value: number | string; limit: number | string }> = {};
    let passed = true;

    const ece = stats.metrics.ece ?? 0;
    const ecePassed = ece <= config.maxExpectedCalibrationError;
    checks['expectedCalibrationError'] = {
      passed: ecePassed,
      value: ece,
      limit: config.maxExpectedCalibrationError,
    };
    if (!ecePassed) passed = false;

    const maxDrawdown = stats.metrics.maxDrawdown ?? 0;
    const ddPassed = maxDrawdown <= config.maxDrawdownLimit;
    checks['maxDrawdown'] = {
      passed: ddPassed,
      value: maxDrawdown,
      limit: config.maxDrawdownLimit,
    };
    if (!ddPassed) passed = false;

    // 3. ROI
    const roiPassed = stats.metrics.roi >= config.minimumRoi;
    checks['roi'] = {
      passed: roiPassed,
      value: stats.metrics.roi,
      limit: config.minimumRoi,
    };
    if (!roiPassed) passed = false;

    // 4. CLV (Closing Line Value)
    const clvPassed = !config.requireClvPositive || stats.metrics.avgClv >= 0;
    checks['averageCLV'] = {
      passed: clvPassed,
      value: stats.metrics.avgClv,
      limit: config.requireClvPositive ? '>= 0' : 'N/A',
    };
    if (!clvPassed) passed = false;

    return {
      passed,
      checks,
    };
  }
}
