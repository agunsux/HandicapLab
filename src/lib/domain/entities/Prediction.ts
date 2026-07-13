/**
 * HandicapLab Domain-Driven Design — Prediction Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';



export interface PredictionDTO {
  id: string;
  fixtureId: string;
  modelId: string;
  marketType: string;
  line: number;
  homeProb: number;
  awayProb: number;
  entropy: number;
  confidence: number;
  calibratedAt: string;
  status: string;
  drawProb?: number | null;
}

export class Prediction {
  readonly id: string;
  readonly _fixtureId: string;
  readonly _modelId: string;
  readonly _marketType: string;
  readonly _line: number;
  readonly _homeProb: number;
  readonly _awayProb: number;
  readonly _entropy: number;
  readonly _confidence: number;
  readonly _calibratedAt: string;
  readonly _status: string;
  readonly _drawProb?: number | null;

  private constructor(
    id: string,
    fixtureId: string,
    modelId: string,
    marketType: string,
    line: number,
    homeProb: number,
    awayProb: number,
    entropy: number,
    confidence: number,
    calibratedAt: string,
    status: string,
    drawProb?: number | null
  ) {
    this.id = id;
    this._fixtureId = fixtureId;
    this._modelId = modelId;
    this._marketType = marketType;
    this._line = line;
    this._homeProb = homeProb;
    this._awayProb = awayProb;
    this._entropy = entropy;
    this._confidence = confidence;
    this._calibratedAt = calibratedAt;
    this._status = status;
    this._drawProb = drawProb;
    Object.freeze(this);
  }

  static create(
    fixtureId: string,
    modelId: string,
    marketType: string,
    line: number,
    homeProb: number,
    awayProb: number,
    entropy: number,
    confidence: number,
    calibratedAt: string,
    status: string,
    drawProb?: number | null
  ): Prediction {
    const id = generateId(ID_PREFIX.PREDICTION);
    return new Prediction(id, fixtureId, modelId, marketType, line, homeProb, awayProb, entropy, confidence, calibratedAt, status, drawProb);
  }

  static fromDTO(dto: PredictionDTO): Prediction {
    return new Prediction(dto.id, dto.fixtureId, dto.modelId, dto.marketType, dto.line, dto.homeProb, dto.awayProb, dto.entropy, dto.confidence, dto.calibratedAt, dto.status, dto.drawProb);
  }

  toDTO(): PredictionDTO {
    return {
      id: this.id,
      fixtureId: this._fixtureId,
      modelId: this._modelId,
      marketType: this._marketType,
      line: this._line,
      homeProb: this._homeProb,
      awayProb: this._awayProb,
      entropy: this._entropy,
      confidence: this._confidence,
      calibratedAt: this._calibratedAt,
      status: this._status,
      drawProb: this._drawProb
    };
  }

  get fixtureId(): string { return this._fixtureId; }
  get modelId(): string { return this._modelId; }
  get marketType(): string { return this._marketType; }
  get line(): number { return this._line; }
  get homeProb(): number { return this._homeProb; }
  get awayProb(): number { return this._awayProb; }
  get entropy(): number { return this._entropy; }
  get confidence(): number { return this._confidence; }
  get calibratedAt(): string { return this._calibratedAt; }
  get status(): string { return this._status; }
  get drawProb(): number | null | undefined { return this._drawProb; }

  equals(other: Prediction): boolean {
    return this.id === other.id &&
      this._fixtureId === other._fixtureId &&
      this._modelId === other._modelId &&
      this._marketType === other._marketType &&
      this._line === other._line &&
      this._homeProb === other._homeProb &&
      this._awayProb === other._awayProb &&
      this._entropy === other._entropy &&
      this._confidence === other._confidence &&
      this._calibratedAt === other._calibratedAt &&
      this._status === other._status &&
      this._drawProb === other._drawProb;
  }

}
