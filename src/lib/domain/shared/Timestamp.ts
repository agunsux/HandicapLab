/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Timestamp
 */
export class Timestamp {
  private readonly _iso: string;
  private readonly _ms: number;
  private constructor(iso: string, ms: number) { this._iso = iso; this._ms = ms; Object.freeze(this); }
  static now() { const d = new Date(); return new Timestamp(d.toISOString(), d.getTime()); }
  static fromISO(iso: string) {
    const ms = Date.parse(iso);
    if (isNaN(ms)) throw new Error('Invalid ISO timestamp: ' + iso);
    return new Timestamp(iso, ms);
  }
  static fromUnix(unix: number) {
    const d = new Date(unix * 1000);
    return new Timestamp(d.toISOString(), d.getTime());
  }
  toISO(): string { return this._iso; }
  toUnix(): number { return Math.floor(this._ms / 1000); }
  isBefore(other: Timestamp): boolean { return this._ms < other._ms; }
  isAfter(other: Timestamp): boolean { return this._ms > other._ms; }
  diffMs(other: Timestamp): number { return this._ms - other._ms; }
  plus(durationMs: number): Timestamp { const t = this._ms + durationMs; return new Timestamp(new Date(t).toISOString(), t); }
  minus(durationMs: number): Timestamp { const t = this._ms - durationMs; return new Timestamp(new Date(t).toISOString(), t); }
  equals(other: Timestamp): boolean { return this._ms === other._ms; }
}
