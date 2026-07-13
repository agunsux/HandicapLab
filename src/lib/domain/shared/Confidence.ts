/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Confidence
 */
export enum ConfidenceLevel { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', VERY_HIGH = 'VERY_HIGH' }
export class Confidence {
  private readonly _score: number;
  private constructor(score: number) {
    if (!Number.isFinite(score)) throw new Error('Invalid confidence: ' + score);
    if (score < 0 || score > 1) throw new Error('Confidence out of range [0,1]: ' + score);
    this._score = score;
    Object.freeze(this);
  }
  static fromScore(score: number) { return new Confidence(score); }
  static fromPercentage(pct: number) { return new Confidence(pct / 100); }
  static LOW = new Confidence(0.15);
  static MEDIUM = new Confidence(0.5);
  static HIGH = new Confidence(0.8);
  static VERY_HIGH = new Confidence(0.95);
  get score(): number { return this._score; }
  getLevel(): ConfidenceLevel {
    if (this._score >= 0.9) return ConfidenceLevel.VERY_HIGH;
    if (this._score >= 0.7) return ConfidenceLevel.HIGH;
    if (this._score >= 0.3) return ConfidenceLevel.MEDIUM;
    return ConfidenceLevel.LOW;
  }
  combine(other: Confidence): Confidence { return new Confidence(this._score * other._score); }
  equals(other: Confidence): boolean { return this._score === other._score; }
}
