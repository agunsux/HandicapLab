import { ICalibrator, CalibratedOutput } from './interface';

export class CalibrationRouter {
  private calibrators: Map<string, ICalibrator> = new Map();

  /**
   * Generates a standard routing key.
   * @param modelVersion e.g., 'Model_v3.4'
   * @param leagueId e.g., '39'
   * @param marketType e.g., 'ML'
   */
  public static generateKey(modelVersion: string, leagueId: string, marketType: string): string {
    return `${modelVersion}_${leagueId}_${marketType}`;
  }

  public register(routingKey: string, calibrator: ICalibrator): void {
    this.calibrators.set(routingKey, calibrator);
  }

  public getCalibrator(routingKey: string): ICalibrator | undefined {
    return this.calibrators.get(routingKey);
  }

  /**
   * Applies calibration if a calibrator is registered for the routing key.
   * Otherwise returns a passthrough with maximum uncertainty.
   */
  public calibrate(routingKey: string, rawProbs: number[]): CalibratedOutput {
    const calibrator = this.getCalibrator(routingKey);
    if (!calibrator) {
      // Passthrough if no calibrator exists, but mark uncertainty as max (1.0) 
      // because we are uncalibrated for this specific segment.
      return {
        probabilities: [...rawProbs],
        uncertaintyScore: 1.0 
      };
    }
    
    return calibrator.transform(rawProbs);
  }

  public exportRegistry(): Record<string, string> {
    const registry: Record<string, string> = {};
    for (const [key, calibrator] of this.calibrators.entries()) {
      registry[key] = calibrator.exportState();
    }
    return registry;
  }

  public importRegistry(registry: Record<string, string>, factory: () => ICalibrator): void {
    this.calibrators.clear();
    for (const [key, state] of Object.entries(registry)) {
      const calibrator = factory();
      calibrator.importState(state);
      this.calibrators.set(key, calibrator);
    }
  }
}

// Singleton instance
export const calibrationRouter = new CalibrationRouter();
