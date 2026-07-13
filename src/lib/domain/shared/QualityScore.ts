/**
 * HandicapLab Domain-Driven Design — Shared Kernel: QualityScore
 */
export type QualityLabel = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
export class QualityScore {
  private readonly _score;
  private constructor(score) {
    if (!Number.isFinite(score)) throw new Error('Invalid quality score: ' + score);
    if (score < 0 || score > 100) throw new Error('Quality score out of range [0,100]: ' + score);
    this._score = Math.round(score);
    Object.freeze(this);
  }
  static fromScore(score) { return new QualityScore(score); }
  get score() { return this._score; }
  getLabel() {
    if (this._score >= 90) return 'EXCELLENT';
    if (this._score >= 70) return 'GOOD';
    if (this._score >= 50) return 'FAIR';
    return 'POOR';
  }
  isPassable(threshold) { threshold = threshold || 70; return this._score >= threshold; }
  combine(weight, other) { return new QualityScore(this._score * weight + other._score * (1 - weight)); }
  equals(other) { return this._score === other._score; }
}
