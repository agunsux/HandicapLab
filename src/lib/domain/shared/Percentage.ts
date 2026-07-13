/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Percentage
 */
export class Percentage {
  private readonly _value: number;
  private constructor(value: number) {
    if (!Number.isFinite(value)) throw new Error('Invalid percentage: ' + value);
    if (value < 0 || value > 1) throw new Error('Percentage out of range [0,1]: ' + value);
    this._value = value;
    Object.freeze(this);
  }
  static fromDecimal(value: number) { return new Percentage(value); }
  static fromRatio(numerator: number, denominator: number) {
    if (denominator === 0) throw new Error('Division by zero');
    return new Percentage(numerator / denominator);
  }
  static fromFraction(value: number) { return new Percentage(value); }
  get value(): number { return this._value; }
  add(other: Percentage): Percentage { return new Percentage(this._value + other._value); }
  subtract(other: Percentage): Percentage { return new Percentage(this._value - other._value); }
  multiply(factor: number): Percentage { return new Percentage(this._value * factor); }
  compare(other: Percentage): number { return this._value - other._value; }
  equals(other: Percentage): boolean { return this._value === other._value; }
  toString(): string { return (this._value * 100).toFixed(1) + '%'; }
  toDTO(): number { return this._value; }
}
