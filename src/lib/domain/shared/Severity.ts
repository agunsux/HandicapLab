/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Severity
 */
export enum SeverityLevel { LOW = 0, MEDIUM = 1, HIGH = 2, CRITICAL = 3, EMERGENCY = 4 }
export class Severity {
  private readonly _level: SeverityLevel;
  constructor(level: SeverityLevel) { this._level = level; Object.freeze(this); }
  static fromLevel(level: SeverityLevel) { return new Severity(level); }
  static fromString(s: string) {
    const map: Record<string, SeverityLevel> = { low: SeverityLevel.LOW, medium: SeverityLevel.MEDIUM, high: SeverityLevel.HIGH, critical: SeverityLevel.CRITICAL, emergency: SeverityLevel.EMERGENCY };
    const level = map[s.toLowerCase()];
    if (level === undefined) throw new Error('Invalid severity: ' + s);
    return new Severity(level);
  }
  static LOW = new Severity(SeverityLevel.LOW);
  static MEDIUM = new Severity(SeverityLevel.MEDIUM);
  static HIGH = new Severity(SeverityLevel.HIGH);
  static CRITICAL = new Severity(SeverityLevel.CRITICAL);
  static EMERGENCY = new Severity(SeverityLevel.EMERGENCY);
  get level(): SeverityLevel { return this._level; }
  isAtLeast(other: Severity): boolean { return this._level >= other._level; }
  isLessThan(other: Severity): boolean { return this._level < other._level; }
  static max(a: Severity, b: Severity): Severity { return a._level >= b._level ? a : b; }
  static min(a: Severity, b: Severity): Severity { return a._level <= b._level ? a : b; }
  toString(): string { return SeverityLevel[this._level].toLowerCase(); }
}
