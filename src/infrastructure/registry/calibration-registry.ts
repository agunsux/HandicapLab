import type { Registry, ValidationResult } from '../../domain/registry';
import type { CalibrationMetadata } from '../../domain/calibration/types';

export class CalibrationRegistry implements Registry<CalibrationMetadata> {
  private registeredItems: Map<string, CalibrationMetadata> = new Map();

  constructor() {
    this.preRegisterCalibrations();
  }

  private preRegisterCalibrations(): void {
    const defaultCalibrations: CalibrationMetadata[] = [
      {
        calibrationId: "platt-epl-default",
        algorithm: "platt",
        trainingWindow: "EPL-2020-2021",
        parameters: { plattA: 1.02, plattB: -0.01 },
        ece: 0.0245,
        logLoss: 0.6456,
        trainingDate: "2026-07-15T12:00:00Z",
        validationDate: "2026-07-15T12:00:00Z",
      },
      {
        calibrationId: "beta-epl-default",
        algorithm: "beta",
        trainingWindow: "EPL-2020-2021",
        parameters: { alpha: 1.05, beta: -0.02, gamma: 0.01 },
        ece: 0.0198,
        logLoss: 0.6402,
        trainingDate: "2026-07-15T12:00:00Z",
        validationDate: "2026-07-15T12:00:00Z",
      },
    ];

    for (const c of defaultCalibrations) {
      this.register(c);
    }
  }

  async register(item: CalibrationMetadata): Promise<void> {
    this.registeredItems.set(item.calibrationId, item);
  }

  async get(id: string): Promise<CalibrationMetadata> {
    const item = this.registeredItems.get(id);
    if (!item) {
      throw new Error(`Calibration with ID ${id} not found in registry.`);
    }
    return item;
  }

  async list(): Promise<CalibrationMetadata[]> {
    return Array.from(this.registeredItems.values());
  }

  async validate(id: string): Promise<ValidationResult> {
    const item = await this.get(id);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (item.ece > 0.05) {
      warnings.push(`Expected Calibration Error (ECE: ${item.ece}) exceeds target threshold of 0.05.`);
    }

    if (item.logLoss > 1.0) {
      errors.push(`Log Loss (${item.logLoss}) is excessively high for a calibrated model.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
