/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Version
 */
export class Version {
  constructor(major, minor, patch) {
    if (major < 0 || minor < 0 || patch < 0) throw new Error('Invalid version: ' + major + '.' + minor + '.' + patch);
    this.major = major; this.minor = minor; this.patch = patch;
    Object.freeze(this);
  }
  static create(major, minor, patch) { return new Version(major, minor, patch); }
  static fromString(s) {
    const parts = s.split('.');
    if (parts.length !== 3) throw new Error('Invalid version string: ' + s);
    return new Version(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10));
  }
  isGreaterThan(other) {
    if (this.major !== other.major) return this.major > other.major;
    if (this.minor !== other.minor) return this.minor > other.minor;
    return this.patch > other.patch;
  }
  isCompatible(other) { return this.major === other.major; }
  bumpMajor() { return new Version(this.major + 1, 0, 0); }
  bumpMinor() { return new Version(this.major, this.minor + 1, 0); }
  bumpPatch() { return new Version(this.major, this.minor, this.patch + 1); }
  equals(other) { return this.major === other.major && this.minor === other.minor && this.patch === other.patch; }
  toString() { return this.major + '.' + this.minor + '.' + this.patch; }
}
