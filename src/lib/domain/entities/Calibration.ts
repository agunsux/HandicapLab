/**
 * HandicapLab Domain-Driven Design — Calibration Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export interface CalibrationBin { binLow: number; binHigh: number; accuracy: number; confidence: number; count: number; }

export interface CalibrationDTO {
  modelId: string;
  datasetId: string;
  ece: number;
  mce: number;
  brierScore: number;
  logLoss: number;
  reliabilityDiagram: CalibrationBin[];
  calibratedAt: string;
  calibrationMethod: string
}

export class Calibration {
  readonly id: string;
  readonly _modelId: string;
  readonly _datasetId: string;
  readonly _ece: number;
  readonly _mce: number;
  readonly _brierScore: number;
  readonly _logLoss: number;
  readonly _reliabilityDiagram: CalibrationBin[];
  readonly _calibratedAt: string;
  readonly _calibrationMethod: string;

  private constructor(
    id: string,
    modelId: string,
    datasetId: string,
    ece: number,
    mce: number,
    brierScore: number,
    logLoss: number,
    reliabilityDiagram: CalibrationBin[],
    calibratedAt: string,
    calibrationMethod: string
  ) {
    this.id = id;
    this._modelId = modelId;
    this._datasetId = datasetId;
    this._ece = ece;
    this._mce = mce;
    this._brierScore = brierScore;
    this._logLoss = logLoss;
    this._reliabilityDiagram = reliabilityDiagram;
    this._calibratedAt = calibratedAt;
    this._calibrationMethod = calibrationMethod;
    Object.freeze(this);
  }

  static create(
    modelId: string,
    datasetId: string,
    ece: number,
    mce: number,
    brierScore: number,
    logLoss: number,
    reliabilityDiagram: CalibrationBin[],
    calibratedAt: string,
    calibrationMethod: string
  ): Calibration {
    const id = generateId(ID_PREFIX.CALIBRATION);
    return new Calibration(id, modelId, datasetId, ece, mce, brierScore, logLoss, reliabilityDiagram, calibratedAt, calibrationMethod);
  }

  static fromDTO(dto: CalibrationDTO): Calibration {
    return new Calibration(dto.id, dto.modelId, dto.datasetId, dto.ece, dto.mce, dto.brierScore, dto.logLoss, dto.reliabilityDiagram, dto.calibratedAt, dto.calibrationMethod);
  }

  toDTO(): CalibrationDTO {
    return {
      id: this.id,
      modelId: this._modelId,
      datasetId: this._datasetId,
      ece: this._ece,
      mce: this._mce,
      brierScore: this._brierScore,
      logLoss: this._logLoss,
      reliabilityDiagram: this._reliabilityDiagram,
      calibratedAt: this._calibratedAt,
      calibrationMethod: this._calibrationMethod
    };
  }

  equals(other: Calibration): boolean {
    return this.id === other.id &&
      this._modelId === other._modelId &&
      this._datasetId === other._datasetId &&
      this._ece === other._ece &&
      this._mce === other._mce &&
      this._brierScore === other._brierScore &&
      this._logLoss === other._logLoss &&
      this._reliabilityDiagram === other._reliabilityDiagram &&
      this._calibratedAt === other._calibratedAt &&
      this._calibrationMethod === other._calibrationMethod;
  }

}
