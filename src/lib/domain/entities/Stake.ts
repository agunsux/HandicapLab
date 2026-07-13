/**
 * HandicapLab Domain-Driven Design — Stake Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type StakeType = 'kelly' | 'flat' | 'variable' | 'proportional';

export interface StakeDTO {
  id: string;
  decisionId: string;
  fixtureId: string;
  amount: number;
  currency: string;
  odds: number;
  stakeType: StakeType;
  fraction: number;
  expectedValue: number;
  maxRisk: number;
}

export class Stake {
  readonly id: string;
  readonly _decisionId: string;
  readonly _fixtureId: string;
  readonly _amount: number;
  readonly _currency: string;
  readonly _odds: number;
  readonly _stakeType: StakeType;
  readonly _fraction: number;
  readonly _expectedValue: number;
  readonly _maxRisk: number;

  private constructor(
    id: string,
    decisionId: string,
    fixtureId: string,
    amount: number,
    currency: string,
    odds: number,
    stakeType: StakeType,
    fraction: number,
    expectedValue: number,
    maxRisk: number
  ) {
    this.id = id;
    this._decisionId = decisionId;
    this._fixtureId = fixtureId;
    this._amount = amount;
    this._currency = currency;
    this._odds = odds;
    this._stakeType = stakeType;
    this._fraction = fraction;
    this._expectedValue = expectedValue;
    this._maxRisk = maxRisk;
    Object.freeze(this);
  }

  static create(
    decisionId: string,
    fixtureId: string,
    amount: number,
    currency: string,
    odds: number,
    stakeType: StakeType,
    fraction: number,
    expectedValue: number,
    maxRisk: number
  ): Stake {
    const id = generateId(ID_PREFIX.STAKE);
    return new Stake(id, decisionId, fixtureId, amount, currency, odds, stakeType, fraction, expectedValue, maxRisk);
  }

  static fromDTO(dto: StakeDTO): Stake {
    return new Stake(dto.id, dto.decisionId, dto.fixtureId, dto.amount, dto.currency, dto.odds, dto.stakeType, dto.fraction, dto.expectedValue, dto.maxRisk);
  }

  toDTO(): StakeDTO {
    return {
      id: this.id,
      decisionId: this._decisionId,
      fixtureId: this._fixtureId,
      amount: this._amount,
      currency: this._currency,
      odds: this._odds,
      stakeType: this._stakeType,
      fraction: this._fraction,
      expectedValue: this._expectedValue,
      maxRisk: this._maxRisk
    };
  }

  get decisionId(): string { return this._decisionId; }
  get fixtureId(): string { return this._fixtureId; }
  get amount(): number { return this._amount; }
  get currency(): string { return this._currency; }
  get odds(): number { return this._odds; }
  get stakeType(): StakeType { return this._stakeType; }
  get fraction(): number { return this._fraction; }
  get expectedValue(): number { return this._expectedValue; }
  get maxRisk(): number { return this._maxRisk; }

  equals(other: Stake): boolean {
    return this.id === other.id &&
      this._decisionId === other._decisionId &&
      this._fixtureId === other._fixtureId &&
      this._amount === other._amount &&
      this._currency === other._currency &&
      this._odds === other._odds &&
      this._stakeType === other._stakeType &&
      this._fraction === other._fraction &&
      this._expectedValue === other._expectedValue &&
      this._maxRisk === other._maxRisk;
  }

}
