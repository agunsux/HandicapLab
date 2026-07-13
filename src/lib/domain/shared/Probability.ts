/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Probability
 */
export class Probability {
  private readonly _value: number;
  private constructor(value: number) {
    if (!Number.isFinite(value)) throw new Error('Invalid probability: ' + value);
    if (value < 0 || value > 1) throw new Error('Probability out of range [0,1]: ' + value);
    this._value = value;
    Object.freeze(this);
  }
  static fromValue(value: number) { return new Probability(value); }
  get value(): number { return this._value; }
  isValid(): boolean { return Number.isFinite(this._value) && this._value >= 0 && this._value <= 1; }
  toDecimalOdds(): number { return this._value === 0 ? Infinity : 1 / this._value; }
  toFractionalOdds(): string {
    if (this._value === 0) return 'Infinity';
    const decimal = this.toDecimalOdds();
    const frac = decimal - 1;
    const denom = 100;
    const num = Math.round(frac * denom);
    return Math.round(num) + '/' + denom;
  }
  toImpliedProbability(): number { return this._value; }
  toLogOdds(): number { return Math.log(this._value / (1 - this._value + 1e-10)); }
  equals(other: Probability): boolean { return this._value === other._value; }
  toString(): string { return (this._value * 100).toFixed(2) + '%'; }
}
