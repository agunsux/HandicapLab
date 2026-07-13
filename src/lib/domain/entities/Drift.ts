/**
 * HandicapLab Domain-Driven Design — Drift Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';



export interface DriftDTO {
  id: string;
  modelId: string;
  driftType: string;
  metric: string;
  deviation: number;
  severity: string;
  detectedAt: string;
}

export class Drift {
  readonly id: string;
  readonly _modelId: string;
  readonly _driftType: string;
  readonly _metric: string;
  readonly _deviation: number;
  readonly _severity: string;
  readonly _detectedAt: string;

  private constructor(
    id: string,
    modelId: string,
    driftType: string,
    metric: string,
    deviation: number,
    severity: string,
    detectedAt: string
  ) {
    this.id = id;
    this._modelId = modelId;
    this._driftType = driftType;
    this._metric = metric;
    this._deviation = deviation;
    this._severity = severity;
    this._detectedAt = detectedAt;
    Object.freeze(this);
  }

  static create(
    modelId: string,
    driftType: string,
    metric: string,
    deviation: number,
    severity: string,
    detectedAt: string
  ): Drift {
    const id = generateId(ID_PREFIX.DRIFT);
    return new Drift(id, modelId, driftType, metric, deviation, severity, detectedAt);
  }

  static fromDTO(dto: DriftDTO): Drift {
    return new Drift(dto.id, dto.modelId, dto.driftType, dto.metric, dto.deviation, dto.severity, dto.detectedAt);
  }

  toDTO(): DriftDTO {
    return {
      id: this.id,
      modelId: this._modelId,
      driftType: this._driftType,
      metric: this._metric,
      deviation: this._deviation,
      severity: this._severity,
      detectedAt: this._detectedAt
    };
  }

  get modelId(): string { return this._modelId; }
  get driftType(): string { return this._driftType; }
  get metric(): string { return this._metric; }
  get deviation(): number { return this._deviation; }
  get severity(): string { return this._severity; }
  get detectedAt(): string { return this._detectedAt; }

  equals(other: Drift): boolean {
    return this.id === other.id &&
      this._modelId === other._modelId &&
      this._driftType === other._driftType &&
      this._metric === other._metric &&
      this._deviation === other._deviation &&
      this._severity === other._severity &&
      this._detectedAt === other._detectedAt;
  }

}
