/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Metadata
 */
export class Metadata {
  private readonly _data: Record<string, unknown>;
  private constructor(data: Record<string, unknown>) { this._data = Object.freeze(Object.assign({}, data)); Object.freeze(this); }
  static fromRecord(data: Record<string, unknown>) { return new Metadata(data); }
  static empty() { return new Metadata({}); }
  get(key: string): unknown { return this._data[key]; }
  set(key: string, value: unknown): Metadata { const copy = Object.assign({}, this._data, { [key]: value }); return new Metadata(copy); }
  has(key: string): boolean { return key in this._data; }
  keys(): string[] { return Object.keys(this._data); }
  merge(other: Metadata): Metadata { return new Metadata(Object.assign({}, this._data, other._data)); }
  toRecord(): Record<string, unknown> { return Object.assign({}, this._data); }
  equals(other: Metadata): boolean {
    const k1 = this.keys();
    const k2 = other.keys();
    if (k1.length !== k2.length) return false;
    return k1.every(k => this._data[k] === other._data[k]);
  }
}
