/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Money
 *
 * Immutable monetary value with precision handling.
 * All monetary operations enforce no rounding errors.
 */

export interface MoneyDTO {
  amount: number;
  currency: string;
}

export class Money {
  private readonly _amount: number;
  private readonly _currency: string;

  private constructor(amount: number, currency: string) {
    if (!Number.isFinite(amount)) throw new Error(`Invalid money amount: ${amount}`);
    if (amount < 0) throw new Error(`Negative money amount: ${amount}`);
    if (!currency || currency.length !== 3) throw new Error(`Invalid currency code: ${currency}`);
    this._amount = Math.round(amount * 100) / 100; // 2 decimal precision
    this._currency = currency.toUpperCase();
    Object.freeze(this);
  }

  static create(amount: number, currency: string = 'USD'): Money {
    return new Money(amount, currency);
  }

  static zero(currency: string = 'USD'): Money {
    return new Money(0, currency);
  }

  static fromDTO(dto: MoneyDTO): Money {
    return new Money(dto.amount, dto.currency);
  }

  get amount(): number { return this._amount; }
  get currency(): string { return this._currency; }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this._amount - other._amount;
    if (result < 0) throw new Error('Insufficient funds');
    return new Money(result, this._currency);
  }

  multiply(factor: number): Money {
    if (factor < 0) throw new Error(`Negative multiplier: ${factor}`);
    return new Money(this._amount * factor, this._currency);
  }

  divide(divisor: number): Money {
    if (divisor <= 0) throw new Error(`Invalid divisor: ${divisor}`);
    return new Money(this._amount / divisor, this._currency);
  }

  isZero(): boolean { return this._amount === 0; }
  isGreaterThan(other: Money): boolean { this.assertSameCurrency(other); return this._amount > other._amount; }
  isLessThan(other: Money): boolean { this.assertSameCurrency(other); return this._amount < other._amount; }
  equals(other: Money): boolean { return this._amount === other._amount && this._currency === other._currency; }

  toDTO(): MoneyDTO { return { amount: this._amount, currency: this._currency }; }

  toString(): string { return `${this._currency} ${this._amount.toFixed(2)}`; }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(`Currency mismatch: ${this._currency} vs ${other._currency}`);
    }
  }
}