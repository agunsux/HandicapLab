/**
 * HandicapLab Domain-Driven Design — Decision Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type DecisionType = 'HOME' | 'AWAY' | 'DRAW' | 'OVER' | 'UNDER' | 'PASS' | 'SKIP';

export interface DecisionDTO {
  fixtureId: string;
  predictionId: string;
  marketType: string;
  line: number;
  decision: DecisionType;
  confidence: number;
  expectedValue: number;
  edge: number;
  reasoning: string;
  madeAt: string
}

export class Decision {
  readonly id: string;
  readonly _fixtureId: string;
  readonly _predictionId: string;
  readonly _marketType: string;
  readonly _line: number;
  readonly _decision: DecisionType;
  readonly _confidence: number;
  readonly _expectedValue: number;
  readonly _edge: number;
  readonly _reasoning: string;
  readonly _madeAt: string;

  private constructor(
    id: string,
    fixtureId: string,
    predictionId: string,
    marketType: string,
    line: number,
    decision: DecisionType,
    confidence: number,
    expectedValue: number,
    edge: number,
    reasoning: string,
    madeAt: string
  ) {
    this.id = id;
    this._fixtureId = fixtureId;
    this._predictionId = predictionId;
    this._marketType = marketType;
    this._line = line;
    this._decision = decision;
    this._confidence = confidence;
    this._expectedValue = expectedValue;
    this._edge = edge;
    this._reasoning = reasoning;
    this._madeAt = madeAt;
    Object.freeze(this);
  }

  static create(
    fixtureId: string,
    predictionId: string,
    marketType: string,
    line: number,
    decision: DecisionType,
    confidence: number,
    expectedValue: number,
    edge: number,
    reasoning: string,
    madeAt: string
  ): Decision {
    const id = generateId(ID_PREFIX.DECISION);
    return new Decision(id, fixtureId, predictionId, marketType, line, decision, confidence, expectedValue, edge, reasoning, madeAt);
  }

  static fromDTO(dto: DecisionDTO): Decision {
    return new Decision(dto.id, dto.fixtureId, dto.predictionId, dto.marketType, dto.line, dto.decision, dto.confidence, dto.expectedValue, dto.edge, dto.reasoning, dto.madeAt);
  }

  toDTO(): DecisionDTO {
    return {
      id: this.id,
      fixtureId: this._fixtureId,
      predictionId: this._predictionId,
      marketType: this._marketType,
      line: this._line,
      decision: this._decision,
      confidence: this._confidence,
      expectedValue: this._expectedValue,
      edge: this._edge,
      reasoning: this._reasoning,
      madeAt: this._madeAt
    };
  }

  equals(other: Decision): boolean {
    return this.id === other.id &&
      this._fixtureId === other._fixtureId &&
      this._predictionId === other._predictionId &&
      this._marketType === other._marketType &&
      this._line === other._line &&
      this._decision === other._decision &&
      this._confidence === other._confidence &&
      this._expectedValue === other._expectedValue &&
      this._edge === other._edge &&
      this._reasoning === other._reasoning &&
      this._madeAt === other._madeAt;
  }

}
