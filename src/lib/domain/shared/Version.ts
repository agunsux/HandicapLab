/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Version
 */
export class Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  constructor(major: number, minor: number, patch: number) {
    if (major < 0 || minor < 0 || patch < 0) throw new Error('Invalid version: ' + major + '.' + minor + '.' + patch);
    this.major = major; this.minor = minor; this.patch = patch;
    Object.freeze(this);
  }
  static create(major: number, minor: number, patch: number) { return new Version(major, minor, patch); }
  static fromString(s: string) {
    const parts = s.split('.');
    if (parts.length !== 3) throw new Error('Invalid version string: ' + s);
    return new Version(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10));
  }
  isGreaterThan(other: Version): boolean {
    if (this.major !== other.major) return this.major > other.major;
    if (this.minor !== other.minor) return this.minor > other.minor;
    return this.patch > other.patch;
  }
  isCompatible(other: Version): boolean { return this.major === other.major; }
  bumpMajor(): Version { return new Version(this.major + 1, 0, 0); }
  bumpMinor(): Version { return new Version(this.major, this.minor + 1, 0); }
  bumpPatch(): Version { return new Version(this.major, this.minor, this.patch + 1); }
  equals(other: Version): boolean { return this.major === other.major && this.minor === other.minor && this.patch === other.patch; }
  toString(): string { return this.major + '.' + this.minor + '.' + this.patch; }
}
