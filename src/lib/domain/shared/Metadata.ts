/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Metadata
 */
export class Metadata {
  private readonly _data;
  private constructor(data) { this._data = Object.freeze(Object.assign({}, data)); Object.freeze(this); }
  static fromRecord(data) { return new Metadata(data); }
  static empty() { return new Metadata({}); }
  get(key) { return this._data[key]; }
  set(key, value) { const copy = Object.assign({}, this._data, { [key]: value }); return new Metadata(copy); }
  has(key) { return key in this._data; }
  keys() { return Object.keys(this._data); }
  merge(other) { return new Metadata(Object.assign({}, this._data, other._data)); }
  toRecord() { return Object.assign({}, this._data); }
  equals(other) {
    const k1 = this.keys();
    const k2 = other.keys();
    if (k1.length !== k2.length) return false;
    return k1.every(k => this._data[k] === other._data[k]);
  }
}
