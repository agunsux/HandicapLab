/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Timestamp
 */
export class Timestamp {
  private readonly _iso;
  private readonly _ms;
  private constructor(iso, ms) { this._iso = iso; this._ms = ms; Object.freeze(this); }
  static now() { const d = new Date(); return new Timestamp(d.toISOString(), d.getTime()); }
  static fromISO(iso) {
    const ms = Date.parse(iso);
    if (isNaN(ms)) throw new Error('Invalid ISO timestamp: ' + iso);
    return new Timestamp(iso, ms);
  }
  static fromUnix(unix) {
    const d = new Date(unix * 1000);
    return new Timestamp(d.toISOString(), d.getTime());
  }
  toISO() { return this._iso; }
  toUnix() { return Math.floor(this._ms / 1000); }
  isBefore(other) { return this._ms < other._ms; }
  isAfter(other) { return this._ms > other._ms; }
  diffMs(other) { return this._ms - other._ms; }
  plus(durationMs) { const t = this._ms + durationMs; return new Timestamp(new Date(t).toISOString(), t); }
  minus(durationMs) { const t = this._ms - durationMs; return new Timestamp(new Date(t).toISOString(), t); }
  equals(other) { return this._ms === other._ms; }
}
