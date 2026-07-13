/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Percentage
 */
export class Percentage {
  private readonly _value;
  private constructor(value) {
    if (!Number.isFinite(value)) throw new Error('Invalid percentage: ' + value);
    if (value < 0 || value > 1) throw new Error('Percentage out of range [0,1]: ' + value);
    this._value = value;
    Object.freeze(this);
  }
  static fromDecimal(value) { return new Percentage(value); }
  static fromRatio(numerator, denominator) {
    if (denominator === 0) throw new Error('Division by zero');
    return new Percentage(numerator / denominator);
  }
  static fromFraction(value) { return new Percentage(value); }
  get value() { return this._value; }
  add(other) { return new Percentage(this._value + other._value); }
  subtract(other) { return new Percentage(this._value - other._value); }
  multiply(factor) { return new Percentage(this._value * factor); }
  compare(other) { return this._value - other._value; }
  equals(other) { return this._value === other._value; }
  toString() { return (this._value * 100).toFixed(1) + '%'; }
  toDTO() { return this._value; }
}
