/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Probability
 */
export class Probability {
  private readonly _value;
  private constructor(value) {
    if (!Number.isFinite(value)) throw new Error('Invalid probability: ' + value);
    if (value < 0 || value > 1) throw new Error('Probability out of range [0,1]: ' + value);
    this._value = value;
    Object.freeze(this);
  }
  static fromValue(value) { return new Probability(value); }
  get value() { return this._value; }
  isValid() { return Number.isFinite(this._value) && this._value >= 0 && this._value <= 1; }
  toDecimalOdds() { return this._value === 0 ? Infinity : 1 / this._value; }
  toFractionalOdds() {
    if (this._value === 0) return 'Infinity';
    const decimal = this.toDecimalOdds();
    const frac = decimal - 1;
    const denom = 100;
    const num = Math.round(frac * denom);
    return Math.round(num) + '/' + denom;
  }
  toImpliedProbability() { return this._value; }
  toLogOdds() { return Math.log(this._value / (1 - this._value + 1e-10)); }
  equals(other) { return this._value === other._value; }
  toString() { return (this._value * 100).toFixed(2) + '%'; }
}
