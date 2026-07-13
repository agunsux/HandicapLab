/**
 * HandicapLab Domain-Driven Design — Probability Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';



export interface ProbabilityDTO {
  fixtureId: string;
  modelId: string;
  homeProb: number;
  awayProb: number;
  drawProb?: number;
  entropy: number;
  confidence: number;
  calibratedAt: string;
  version?: string
}

export class Probability {
  readonly id: string;
  readonly _fixtureId: string;
  readonly _modelId: string;
  readonly _homeProb: number;
  readonly _awayProb: number;
  readonly _drawProb: number;
  readonly _entropy: number;
  readonly _confidence: number;
  readonly _calibratedAt: string;
  readonly _version: string;

  private constructor(
    id: string,
    fixtureId: string,
    modelId: string,
    homeProb: number,
    awayProb: number,
    drawProb?: number,
    entropy: number,
    confidence: number,
    calibratedAt: string,
    version?: string
  ) {
    this.id = id;
    this._fixtureId = fixtureId;
    this._modelId = modelId;
    this._homeProb = homeProb;
    this._awayProb = awayProb;
    this._drawProb = drawProb;
    this._entropy = entropy;
    this._confidence = confidence;
    this._calibratedAt = calibratedAt;
    this._version = version;
    Object.freeze(this);
  }

  static create(
    fixtureId: string,
    modelId: string,
    homeProb: number,
    awayProb: number,
    drawProb?: number,
    entropy: number,
    confidence: number,
    calibratedAt: string,
    version?: string
  ): Probability {
    const id = generateId(ID_PREFIX.PROBABILITY);
    return new Probability(id, fixtureId, modelId, homeProb, awayProb, drawProb, entropy, confidence, calibratedAt, version);
  }

  static fromDTO(dto: ProbabilityDTO): Probability {
    return new Probability(dto.id, dto.fixtureId, dto.modelId, dto.homeProb, dto.awayProb, dto.drawProb, dto.entropy, dto.confidence, dto.calibratedAt, dto.version);
  }

  toDTO(): ProbabilityDTO {
    return {
      id: this.id,
      fixtureId: this._fixtureId,
      modelId: this._modelId,
      homeProb: this._homeProb,
      awayProb: this._awayProb,
      drawProb: this._drawProb,
      entropy: this._entropy,
      confidence: this._confidence,
      calibratedAt: this._calibratedAt,
      version: this._version
    };
  }

  equals(other: Probability): boolean {
    return this.id === other.id &&
      this._fixtureId === other._fixtureId &&
      this._modelId === other._modelId &&
      this._homeProb === other._homeProb &&
      this._awayProb === other._awayProb &&
      this._drawProb === other._drawProb &&
      this._entropy === other._entropy &&
      this._confidence === other._confidence &&
      this._calibratedAt === other._calibratedAt &&
      this._version === other._version;
  }

}
