/**
 * HandicapLab Domain-Driven Design — Risk Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type RiskType = 'concentration' | 'drawdown' | 'liquidity' | 'model' | 'counterparty' | 'operational';

export interface RiskDTO {
  portfolioId: string;
  riskType: RiskType;
  value: number;
  limit: number;
  exceeded: boolean;
  detectedAt: string;
  mitigations: string[]
}

export class Risk {
  readonly id: string;
  readonly _portfolioId: string;
  readonly _riskType: RiskType;
  readonly _value: number;
  readonly _limit: number;
  readonly _exceeded: boolean;
  readonly _detectedAt: string;
  readonly _mitigations: string[];

  private constructor(
    id: string,
    portfolioId: string,
    riskType: RiskType,
    value: number,
    limit: number,
    exceeded: boolean,
    detectedAt: string,
    mitigations: string[]
  ) {
    this.id = id;
    this._portfolioId = portfolioId;
    this._riskType = riskType;
    this._value = value;
    this._limit = limit;
    this._exceeded = exceeded;
    this._detectedAt = detectedAt;
    this._mitigations = mitigations;
    Object.freeze(this);
  }

  static create(
    portfolioId: string,
    riskType: RiskType,
    value: number,
    limit: number,
    exceeded: boolean,
    detectedAt: string,
    mitigations: string[]
  ): Risk {
    const id = generateId(ID_PREFIX.RISK);
    return new Risk(id, portfolioId, riskType, value, limit, exceeded, detectedAt, mitigations);
  }

  static fromDTO(dto: RiskDTO): Risk {
    return new Risk(dto.id, dto.portfolioId, dto.riskType, dto.value, dto.limit, dto.exceeded, dto.detectedAt, dto.mitigations);
  }

  toDTO(): RiskDTO {
    return {
      id: this.id,
      portfolioId: this._portfolioId,
      riskType: this._riskType,
      value: this._value,
      limit: this._limit,
      exceeded: this._exceeded,
      detectedAt: this._detectedAt,
      mitigations: this._mitigations
    };
  }

  equals(other: Risk): boolean {
    return this.id === other.id &&
      this._portfolioId === other._portfolioId &&
      this._riskType === other._riskType &&
      this._value === other._value &&
      this._limit === other._limit &&
      this._exceeded === other._exceeded &&
      this._detectedAt === other._detectedAt &&
      this._mitigations === other._mitigations;
  }

}
