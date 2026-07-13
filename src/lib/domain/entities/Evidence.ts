/**
 * HandicapLab Domain-Driven Design — Evidence Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';



export interface EvidenceDTO {
  replayId: string;
  fixtureId: string;
  predictionId: string;
  actualOutcome: number;
  predictedProb: number;
  clv: number;
  calibrationError: number;
  timestamp: string;
  chainHash: string;
  previousHash: string
}

export class Evidence {
  readonly id: string;
  readonly _replayId: string;
  readonly _fixtureId: string;
  readonly _predictionId: string;
  readonly _actualOutcome: number;
  readonly _predictedProb: number;
  readonly _clv: number;
  readonly _calibrationError: number;
  readonly _timestamp: string;
  readonly _chainHash: string;
  readonly _previousHash: string;

  private constructor(
    id: string,
    replayId: string,
    fixtureId: string,
    predictionId: string,
    actualOutcome: number,
    predictedProb: number,
    clv: number,
    calibrationError: number,
    timestamp: string,
    chainHash: string,
    previousHash: string
  ) {
    this.id = id;
    this._replayId = replayId;
    this._fixtureId = fixtureId;
    this._predictionId = predictionId;
    this._actualOutcome = actualOutcome;
    this._predictedProb = predictedProb;
    this._clv = clv;
    this._calibrationError = calibrationError;
    this._timestamp = timestamp;
    this._chainHash = chainHash;
    this._previousHash = previousHash;
    Object.freeze(this);
  }

  static create(
    replayId: string,
    fixtureId: string,
    predictionId: string,
    actualOutcome: number,
    predictedProb: number,
    clv: number,
    calibrationError: number,
    timestamp: string,
    chainHash: string,
    previousHash: string
  ): Evidence {
    const id = generateId(ID_PREFIX.EVIDENCE);
    return new Evidence(id, replayId, fixtureId, predictionId, actualOutcome, predictedProb, clv, calibrationError, timestamp, chainHash, previousHash);
  }

  static fromDTO(dto: EvidenceDTO): Evidence {
    return new Evidence(dto.id, dto.replayId, dto.fixtureId, dto.predictionId, dto.actualOutcome, dto.predictedProb, dto.clv, dto.calibrationError, dto.timestamp, dto.chainHash, dto.previousHash);
  }

  toDTO(): EvidenceDTO {
    return {
      id: this.id,
      replayId: this._replayId,
      fixtureId: this._fixtureId,
      predictionId: this._predictionId,
      actualOutcome: this._actualOutcome,
      predictedProb: this._predictedProb,
      clv: this._clv,
      calibrationError: this._calibrationError,
      timestamp: this._timestamp,
      chainHash: this._chainHash,
      previousHash: this._previousHash
    };
  }

  equals(other: Evidence): boolean {
    return this.id === other.id &&
      this._replayId === other._replayId &&
      this._fixtureId === other._fixtureId &&
      this._predictionId === other._predictionId &&
      this._actualOutcome === other._actualOutcome &&
      this._predictedProb === other._predictedProb &&
      this._clv === other._clv &&
      this._calibrationError === other._calibrationError &&
      this._timestamp === other._timestamp &&
      this._chainHash === other._chainHash &&
      this._previousHash === other._previousHash;
  }

}
