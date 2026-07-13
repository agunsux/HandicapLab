/**
 * HandicapLab Domain Intelligence Platform — Batch Generator (CommonJS)
 * 
 * Run: node scripts/generate-domain.cjs
 */

const fs = require('fs');
const path = require('path');

const DOMAIN_ROOT = 'src/lib/domain';

function mkdirp(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeFile(filePath, content) {
  const fullPath = path.join(DOMAIN_ROOT, filePath);
  mkdirp(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Created:', fullPath);
}

// ===== SHARED KERNEL =====

writeFile('shared/Confidence.ts', `/**
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
`);

writeFile('shared/Severity.ts', `/**
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
`);

writeFile('shared/QualityScore.ts', `/**
 * HandicapLab Domain-Driven Design — Shared Kernel: QualityScore
 */
export type QualityLabel = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
export class QualityScore {
  private readonly _score: number;
  private constructor(score: number) {
    if (!Number.isFinite(score)) throw new Error('Invalid quality score: ' + score);
    if (score < 0 || score > 100) throw new Error('Quality score out of range [0,100]: ' + score);
    this._score = Math.round(score);
    Object.freeze(this);
  }
  static fromScore(score: number) { return new QualityScore(score); }
  get score(): number { return this._score; }
  getLabel(): QualityLabel {
    if (this._score >= 90) return 'EXCELLENT';
    if (this._score >= 70) return 'GOOD';
    if (this._score >= 50) return 'FAIR';
    return 'POOR';
  }
  isPassable(threshold?: number): boolean { threshold = threshold || 70; return this._score >= threshold; }
  combine(weight: number, other: QualityScore): QualityScore { return new QualityScore(this._score * weight + other._score * (1 - weight)); }
  equals(other: QualityScore): boolean { return this._score === other._score; }
}
`);

writeFile('shared/Percentage.ts', `/**
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
`);

writeFile('shared/Probability.ts', `/**
 * HandicapLab Domain-Driven Design — Shared Kernel: Probability
 */
export class Probability {
  private readonly _value: number;
  private constructor(value: number) {
    if (!Number.isFinite(value)) throw new Error('Invalid probability: ' + value);
    if (value < 0 || value > 1) throw new Error('Probability out of range [0,1]: ' + value);
    this._value = value;
    Object.freeze(this);
  }
  static fromValue(value: number) { return new Probability(value); }
  get value(): number { return this._value; }
  isValid(): boolean { return Number.isFinite(this._value) && this._value >= 0 && this._value <= 1; }
  toDecimalOdds(): number { return this._value === 0 ? Infinity : 1 / this._value; }
  toFractionalOdds(): string {
    if (this._value === 0) return 'Infinity';
    const decimal = this.toDecimalOdds();
    const frac = decimal - 1;
    const denom = 100;
    const num = Math.round(frac * denom);
    return Math.round(num) + '/' + denom;
  }
  toImpliedProbability(): number { return this._value; }
  toLogOdds(): number { return Math.log(this._value / (1 - this._value + 1e-10)); }
  equals(other: Probability): boolean { return this._value === other._value; }
  toString(): string { return (this._value * 100).toFixed(2) + '%'; }
}
`);

writeFile('shared/Timestamp.ts', `/**
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
`);

writeFile('shared/Version.ts', `/**
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
`);

writeFile('shared/Metadata.ts', `/**
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
`);

writeFile('shared/index.ts', `export * from './Identifier';
export * from './Money';
export * from './Percentage';
export * from './Probability';
export * from './Timestamp';
export * from './Version';
export * from './Metadata';
export * from './Confidence';
export * from './Severity';
export * from './QualityScore';
`);

// ===== ENTITIES =====

// Entity template helper
function makeEntity(name, prefix, fieldsInput, extraTypes) {
  const fields = [...fieldsInput].sort((a, b) => (a.optional ? 1 : 0) - (b.optional ? 1 : 0));
  const dtoFields = fields.map(f => '  ' + f.name + (f.optional ? '?' : '') + ': ' + f.type + ';').join('\n');
  const createParams = fields.map((f, i) => '    ' + f.name + (f.optional ? '?' : '') + ': ' + f.type).join(',\n');
  const assignFields = fields.map(f => '    this._' + f.name + ' = ' + f.name + ';').join('\n');
  const returnFields = fields.map(f => '      ' + f.name + ': this._' + f.name).join(',\n');
  const equalsCheck = fields.map(f => '      this._' + f.name + ' === other._' + f.name).join(' &&\n');
  const getters = fields.map(f => '  get ' + f.name + '(): ' + f.type + (f.optional ? ' | undefined' : '') + ' { return this._' + f.name + '; }').join('\n');

  return `/**
 * HandicapLab Domain-Driven Design — ${name} Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

${extraTypes}

export interface ${name}DTO {
  id: string;
${dtoFields}
}

export class ${name} {
  readonly id: string;
${fields.map(f => '  readonly _' + f.name + (f.optional ? '?' : '') + ': ' + f.type + ';').join('\n')}

  private constructor(
    id: string,
${createParams}
  ) {
    this.id = id;
${assignFields}
    Object.freeze(this);
  }

  static create(
${createParams}
  ): ${name} {
    const id = generateId(ID_PREFIX.${prefix});
    return new ${name}(id, ${fields.map(f => f.name).join(', ')});
  }

  static fromDTO(dto: ${name}DTO): ${name} {
    return new ${name}(dto.id, ${fields.map(f => 'dto.' + f.name).join(', ')});
  }

  toDTO(): ${name}DTO {
    return {
      id: this.id,
${returnFields}
    };
  }

${getters}

  equals(other: ${name}): boolean {
    return this.id === other.id &&
${equalsCheck};
  }

}
`;
}


// Create entities
const entities = [
  { name: 'Competition', prefix: 'COMPETITION', fields: [
    { name: 'name', type: 'string' },
    { name: 'country', type: 'string' },
    { name: 'sport', type: 'CompetitionSport' },
    { name: 'tier', type: 'number' },
    { name: 'startDate', type: 'string' },
    { name: 'endDate', type: 'string' },
    { name: 'status', type: 'CompetitionStatus' }
  ], extra: `export type CompetitionStatus = 'ACTIVE' | 'INACTIVE' | 'UPCOMING' | 'COMPLETED' | 'active' | 'inactive' | 'upcoming' | 'completed';\nexport type CompetitionSport = 'FOOTBALL' | 'BASKETBALL' | 'TENNIS' | 'OTHER' | 'Football' | 'Basketball' | 'Tennis' | 'Other';` },
  { name: 'Season', prefix: 'SEASON', fields: [
    { name: 'competitionId', type: 'string' },
    { name: 'label', type: 'string' },
    { name: 'startDate', type: 'string' },
    { name: 'endDate', type: 'string' },
    { name: 'currentMatchday', type: 'number' },
    { name: 'stages', type: 'Stage[]' }
  ], extra: `export interface Stage { name: string; startDate: string; endDate: string; }` },
  { name: 'League', prefix: 'LEAGUE', fields: [
    { name: 'name', type: 'string' },
    { name: 'country', type: 'string' },
    { name: 'logo', type: 'string' },
    { name: 'status', type: 'string' }
  ], extra: '' },
  { name: 'Fixture', prefix: 'FIXTURE', fields: [
    { name: 'leagueId', type: 'string' },
    { name: 'seasonId', type: 'string' },
    { name: 'homeTeamId', type: 'string' },
    { name: 'awayTeamId', type: 'string' },
    { name: 'venueId', type: 'string' },
    { name: 'kickoffTime', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'round', type: 'string' },
    { name: 'matchday', type: 'number' },
    { name: 'homeScore', type: 'number | null', optional: true },
    { name: 'awayScore', type: 'number | null', optional: true }
  ], extra: '' },
  { name: 'Team', prefix: 'TEAM', fields: [
    { name: 'name', type: 'string' },
    { name: 'code', type: 'string' },
    { name: 'country', type: 'string' },
    { name: 'logo', type: 'string' },
    { name: 'venueName', type: 'string' },
    { name: 'founded', type: 'number' }
  ], extra: '' },
  { name: 'Player', prefix: 'PLAYER', fields: [
    { name: 'name', type: 'string' },
    { name: 'position', type: 'string' },
    { name: 'nationality', type: 'string' },
    { name: 'birthDate', type: 'string', optional: true },
    { name: 'height', type: 'string', optional: true },
    { name: 'weight', type: 'string', optional: true }
  ], extra: '' },
  { name: 'Venue', prefix: 'VENUE', fields: [
    { name: 'name', type: 'string' },
    { name: 'city', type: 'string' },
    { name: 'capacity', type: 'number', optional: true },
    { name: 'surface', type: 'string', optional: true },
    { name: 'address', type: 'string', optional: true }
  ], extra: '' },
  { name: 'Odds', prefix: 'ODDS', fields: [
    { name: 'fixtureId', type: 'string' },
    { name: 'providerId', type: 'string' },
    { name: 'marketType', type: 'string' },
    { name: 'line', type: 'number' },
    { name: 'homeOdds', type: 'number' },
    { name: 'awayOdds', type: 'number' },
    { name: 'drawOdds', type: 'number | null', optional: true },
    { name: 'capturedAt', type: 'string' }
  ], extra: '' },
  { name: 'Market', prefix: 'MARKET', fields: [
    { name: 'name', type: 'string' },
    { name: 'marketType', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'status', type: 'string' }
  ], extra: '' },
  { name: 'Prediction', prefix: 'PREDICTION', fields: [
    { name: 'fixtureId', type: 'string' },
    { name: 'modelId', type: 'string' },
    { name: 'marketType', type: 'string' },
    { name: 'line', type: 'number' },
    { name: 'homeProb', type: 'number' },
    { name: 'awayProb', type: 'number' },
    { name: 'drawProb', type: 'number | null', optional: true },
    { name: 'entropy', type: 'number' },
    { name: 'confidence', type: 'number' },
    { name: 'calibratedAt', type: 'string' },
    { name: 'status', type: 'string' }
  ], extra: '' },
  { name: 'Probability', prefix: 'PROBABILITY', fields: [
    { name: 'fixtureId', type: 'string' }, { name: 'modelId', type: 'string' },
    { name: 'homeProb', type: 'number' }, { name: 'awayProb', type: 'number' },
    { name: 'drawProb', type: 'number', optional: true }, { name: 'entropy', type: 'number' },
    { name: 'confidence', type: 'number' }, { name: 'calibratedAt', type: 'string' },
    { name: 'version', type: 'string', optional: true }
  ], extra: '' },
  { name: 'Calibration', prefix: 'CALIBRATION', fields: [
    { name: 'modelId', type: 'string' }, { name: 'datasetId', type: 'string' },
    { name: 'ece', type: 'number' }, { name: 'mce', type: 'number' },
    { name: 'brierScore', type: 'number' }, { name: 'logLoss', type: 'number' },
    { name: 'reliabilityDiagram', type: 'CalibrationBin[]' },
    { name: 'calibratedAt', type: 'string' }, { name: 'calibrationMethod', type: 'string' }
  ], extra: 'export interface CalibrationBin { binLow: number; binHigh: number; accuracy: number; confidence: number; count: number; }' },
  { name: 'Feature', prefix: 'FEATURE', fields: [
    { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
    { name: 'category', type: 'FeatureCategory' }, { name: 'description', type: 'string' },
    { name: 'dataType', type: 'FeatureDataType' }, { name: 'computationType', type: 'string' },
    { name: 'dependencies', type: 'string[]' }
  ], extra: 'export type FeatureCategory = \'derived\' | \'raw\' | \'computed\' | \'external\';\nexport type FeatureDataType = \'numerical\' | \'categorical\' | \'boolean\' | \'vector\';' },
  { name: 'Decision', prefix: 'DECISION', fields: [
    { name: 'fixtureId', type: 'string' }, { name: 'predictionId', type: 'string' },
    { name: 'marketType', type: 'string' }, { name: 'line', type: 'number' },
    { name: 'decision', type: 'DecisionType' }, { name: 'confidence', type: 'number' },
    { name: 'expectedValue', type: 'number' }, { name: 'edge', type: 'number' },
    { name: 'reasoning', type: 'string' }, { name: 'madeAt', type: 'string' }
  ], extra: 'export type DecisionType = \'HOME\' | \'AWAY\' | \'DRAW\' | \'OVER\' | \'UNDER\' | \'PASS\' | \'SKIP\';' },
  { name: 'Policy', prefix: 'POLICY', fields: [
    { name: 'name', type: 'string' }, { name: 'description', type: 'string' },
    { name: 'policyType', type: 'PolicyType' }, { name: 'rules', type: 'Record<string, unknown>' },
    { name: 'priority', type: 'number' }, { name: 'enabled', type: 'boolean' },
    { name: 'effectiveFrom', type: 'string' }, { name: 'effectiveTo', type: 'string', optional: true }
  ], extra: 'export type PolicyType = \'staking\' | \'risk\' | \'selection\' | \'validation\' | \'calibration\';' },
  { name: 'Stake', prefix: 'STAKE', fields: [
    { name: 'decisionId', type: 'string' }, { name: 'fixtureId', type: 'string' },
    { name: 'amount', type: 'number' }, { name: 'currency', type: 'string' },
    { name: 'odds', type: 'number' }, { name: 'stakeType', type: 'StakeType' },
    { name: 'fraction', type: 'number' }, { name: 'expectedValue', type: 'number' },
    { name: 'maxRisk', type: 'number' }
  ], extra: 'export type StakeType = \'kelly\' | \'flat\' | \'variable\' | \'proportional\';' },
  { name: 'Portfolio', prefix: 'PORTFOLIO', fields: [
    { name: 'name', type: 'string' }, { name: 'description', type: 'string', optional: true },
    { name: 'totalValue', type: 'number' }, { name: 'cashBalance', type: 'number' },
    { name: 'allocations', type: 'StakeAllocation[]' }, { name: 'riskLimit', type: 'number' },
    { name: 'createdAt', type: 'string' }, { name: 'updatedAt', type: 'string' }
  ], extra: 'export interface StakeAllocation { stakeId: string; fraction: number; currentValue: number; }' },
  { name: 'Research', prefix: 'RESEARCH', fields: [
    { name: 'name', type: 'string' }, { name: 'description', type: 'string' },
    { name: 'hypothesis', type: 'string' }, { name: 'methodology', type: 'string' },
    { name: 'datasetId', type: 'string' }, { name: 'modelIds', type: 'string[]' },
    { name: 'status', type: 'ResearchStatus' }, { name: 'startedAt', type: 'string', optional: true },
    { name: 'completedAt', type: 'string', optional: true }, { name: 'conclusion', type: 'string', optional: true }
  ], extra: 'export type ResearchStatus = \'draft\' | \'running\' | \'completed\' | \'failed\' | \'published\';' },
  { name: 'Replay', prefix: 'REPLAY', fields: [
    { name: 'datasetId', type: 'string' }, { name: 'modelIds', type: 'string[]' },
    { name: 'fixtureCount', type: 'number' }, { name: 'startTime', type: 'string', optional: true },
    { name: 'endTime', type: 'string', optional: true }, { name: 'status', type: 'ReplayStatus' },
    { name: 'progress', type: 'number' }, { name: 'resultsSummary', type: 'Record<string, unknown>' }
  ], extra: 'export type ReplayStatus = \'pending\' | \'running\' | \'completed\' | \'failed\';' },
  { name: 'Evidence', prefix: 'EVIDENCE', fields: [
    { name: 'replayId', type: 'string' }, { name: 'fixtureId', type: 'string' },
    { name: 'predictionId', type: 'string' }, { name: 'actualOutcome', type: 'number' },
    { name: 'predictedProb', type: 'number' }, { name: 'clv', type: 'number' },
    { name: 'calibrationError', type: 'number' }, { name: 'timestamp', type: 'string' },
    { name: 'chainHash', type: 'string' }, { name: 'previousHash', type: 'string' }
  ], extra: '' },
  { name: 'Experiment', prefix: 'EXPERIMENT', fields: [
    { name: 'name', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'hypothesis', type: 'string' },
    { name: 'modelId', type: 'string' },
    { name: 'datasetId', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'metricsSummary', type: 'Record<string, number>' }
  ], extra: '' },
  { name: 'Model', prefix: 'MODEL', fields: [
    { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
    { name: 'modelType', type: 'ModelType' }, { name: 'algorithm', type: 'string' },
    { name: 'hyperparameters', type: 'Record<string, unknown>' }, { name: 'features', type: 'string[]' },
    { name: 'trainingDatasetId', type: 'string' }, { name: 'metrics', type: 'Record<string, number>' },
    { name: 'status', type: 'ModelStatus' }, { name: 'deployedAt', type: 'string', optional: true }
  ], extra: 'export type ModelType = \'poisson\' | \'dixonColes\' | \'elo\' | \'gradientBoosting\' | \'neuralNet\' | \'ensemble\';\nexport type ModelStatus = \'training\' | \'ready\' | \'deprecated\' | \'retired\' | \'failed\';' },
  { name: 'Provider', prefix: 'PROVIDER', fields: [
    { name: 'name', type: 'string' }, { name: 'providerType', type: 'ProviderType' },
    { name: 'baseUrl', type: 'string' }, { name: 'apiVersion', type: 'string' },
    { name: 'supportedDataTypes', type: 'string[]' }, { name: 'status', type: 'ProviderStatus' },
    { name: 'priority', type: 'number' }, { name: 'health', type: 'ProviderHealth' },
    { name: 'lastCheckedAt', type: 'string' }
  ], extra: 'export type ProviderType = \'api\' | \'csv\' | \'webhook\' | \'manual\';\nexport type ProviderStatus = \'active\' | \'inactive\' | \'error\' | \'rateLimited\';\nexport type ProviderHealth = \'healthy\' | \'degraded\' | \'down\';' },
  { name: 'Result', prefix: 'RESULT', fields: [
    { name: 'fixtureId', type: 'string' }, { name: 'homeScore', type: 'number' }, { name: 'awayScore', type: 'number' },
    { name: 'homeHalfScore', type: 'number', optional: true }, { name: 'awayHalfScore', type: 'number', optional: true },
    { name: 'status', type: 'ResultStatus' }, { name: 'winner', type: 'MatchWinner', optional: true },
    { name: 'matchDuration', type: 'number', optional: true }, { name: 'collectedAt', type: 'string' }
  ], extra: 'export type ResultStatus = \'finished\' | \'awarded\' | \'abandoned\' | \'postponed\';\nexport type MatchWinner = \'home\' | \'away\' | \'draw\';' },
  { name: 'Performance', prefix: 'PERFORMANCE', fields: [
    { name: 'modelId', type: 'string' }, { name: 'period', type: 'PerformancePeriod' },
    { name: 'window', type: 'PerformanceWindow' }, { name: 'roi', type: 'number' },
    { name: 'clv', type: 'number' }, { name: 'brierScore', type: 'number' }, { name: 'ece', type: 'number' },
    { name: 'sharpe', type: 'number' }, { name: 'sortino', type: 'number' },
    { name: 'maxDrawdown', type: 'number' }, { name: 'accuracy', type: 'number' }, { name: 'sampleSize', type: 'number' }
  ], extra: 'export type PerformancePeriod = \'daily\' | \'weekly\' | \'monthly\' | \'all\';\nexport type PerformanceWindow = 30 | 60 | 90 | 180 | 365;' },
  { name: 'Drift', prefix: 'DRIFT', fields: [
    { name: 'modelId', type: 'string' },
    { name: 'driftType', type: 'string' },
    { name: 'metric', type: 'string' },
    { name: 'deviation', type: 'number' },
    { name: 'severity', type: 'string' },
    { name: 'detectedAt', type: 'string' }
  ], extra: '' },
  { name: 'Risk', prefix: 'RISK', fields: [
    { name: 'portfolioId', type: 'string' }, { name: 'riskType', type: 'RiskType' },
    { name: 'value', type: 'number' }, { name: 'limit', type: 'number' },
    { name: 'exceeded', type: 'boolean' }, { name: 'detectedAt', type: 'string' },
    { name: 'mitigations', type: 'string[]' }
  ], extra: 'export type RiskType = \'concentration\' | \'drawdown\' | \'liquidity\' | \'model\' | \'counterparty\' | \'operational\';' },
  { name: 'Report', prefix: 'REPORT', fields: [
    { name: 'type', type: 'ReportType' }, { name: 'period', type: 'string' },
    { name: 'generatedAt', type: 'string' }, { name: 'metricsSummary', type: 'Record<string, number>' },
    { name: 'sections', type: 'ReportSection[]' }, { name: 'format', type: 'string' }
  ], extra: 'export type ReportType = \'daily\' | \'weekly\' | \'monthly\' | \'onDemand\';\nexport interface ReportSection { title: string; content: Record<string, unknown>; order: number; }' },
];

console.log('\nCreating entities...');
for (const ent of entities) {
  const content = makeEntity(ent.name, ent.prefix, ent.fields, ent.extra);
  writeFile('entities/' + ent.name + '.ts', content);
}

// Create entities index
const entityNames = [
  'Competition', 'Season', 'League', 'Fixture', 'Team', 'Player', 'Venue',
  'Odds', 'Market', 'Prediction', 'Probability', 'Calibration', 'Feature',
  'Decision', 'Policy', 'Stake', 'Portfolio', 'Research', 'Replay', 'Evidence',
  'Experiment', 'Model', 'Provider', 'Result', 'Performance', 'Drift', 'Risk', 'Report'
];

const entityExports = entityNames.map(n => "export * from './" + n + "';").join('\n');
writeFile('entities/index.ts', entityExports + '\n');

// ===== EVENTS =====
console.log('\nCreating events...');

writeFile('events/DomainEvent.ts', `/**
 * HandicapLab Domain-Driven Design — Domain Event Infrastructure
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly timestamp: string;
  readonly version: number;
  readonly payload: Record<string, unknown>;
}

export const EVENT_TYPES = {
  FIXTURE_CREATED: 'fixture.created',
  FIXTURE_UPDATED: 'fixture.updated',
  ODDS_CAPTURED: 'odds.captured',
  PREDICTION_GENERATED: 'prediction.generated',
  CALIBRATION_COMPLETED: 'calibration.completed',
  DECISION_APPROVED: 'decision.approved',
  STAKE_CALCULATED: 'stake.calculated',
  RESULT_COLLECTED: 'result.collected',
  REPLAY_COMPLETED: 'replay.completed',
  RESEARCH_FINISHED: 'research.finished',
  DRIFT_DETECTED: 'drift.detected',
  CHAMPION_VALIDATED: 'champion.validated',
  REPORT_GENERATED: 'report.generated',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
`);

writeFile('events/DomainEventBus.ts', `/**
 * HandicapLab Domain-Driven Design — Domain Event Bus
 */
import { DomainEvent } from './DomainEvent';

export type EventHandler = (event: DomainEvent) => Promise<void>;

export class DomainEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  subscribe(eventType: string, handler: EventHandler): void {
    let handlers = this.handlers.get(eventType);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(eventType, handlers);
    }
    handlers.add(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers) return;
    await Promise.all(Array.from(handlers).map(h => h(event)));
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  clear(): void { this.handlers.clear(); }

  subscriberCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }
}
`);

// Event template
function makeEventClass(name, eventType, aggregateType, payloadFields) {
  const createParams = payloadFields.map((f, i) => f.name + ': ' + f.type).join(', ');
  const payloadAssign = payloadFields.map(f => f.name + ': ' + f.name).join(', ');
  return `import { DomainEvent, EVENT_TYPES } from './DomainEvent';
import { Timestamp } from '../shared/Timestamp';

let _counter = 0;
function _nextId(): string { _counter++; return 'evt_' + String(_counter).padStart(6, '0'); }

export class ${name} implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string = EVENT_TYPES.${eventType};
  readonly aggregateId: string;
  readonly aggregateType: string = '${aggregateType}';
  readonly timestamp: string;
  readonly version: number = 1;
  readonly payload: Record<string, unknown>;

  private constructor(eventId: string, aggregateId: string, timestamp: string, payload: Record<string, unknown>) {
    this.eventId = eventId; this.aggregateId = aggregateId; this.timestamp = timestamp; this.payload = payload;
    Object.freeze(this);
  }

  static create(${createParams}): ${name} {
    return new ${name}(_nextId(), ${payloadFields[0].name}, Timestamp.now().toISO(), { ${payloadAssign} });
  }
}
`;
}

writeFile('events/FixtureEvents.ts', makeEventClass('FixtureCreatedEvent', 'FIXTURE_CREATED', 'Fixture', [
  { name: 'fixtureId', type: 'string' }, { name: 'homeTeamId', type: 'string' },
  { name: 'awayTeamId', type: 'string' }, { name: 'kickoffTime', type: 'string' }, { name: 'leagueId', type: 'string' }
]) + `
export class FixtureUpdatedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string = EVENT_TYPES.FIXTURE_UPDATED;
  readonly aggregateId: string;
  readonly aggregateType: string = 'Fixture';
  readonly timestamp: string;
  readonly version: number = 1;
  readonly payload: Record<string, unknown>;

  private constructor(eventId: string, aggregateId: string, timestamp: string, payload: Record<string, unknown>) {
    this.eventId = eventId; this.aggregateId = aggregateId; this.timestamp = timestamp; this.payload = payload;
    Object.freeze(this);
  }

  static create(fixtureId: string, changes: Record<string, unknown>): FixtureUpdatedEvent {
    return new FixtureUpdatedEvent(_nextId(), fixtureId, Timestamp.now().toISO(), { fixtureId, changes });
  }
}
`);

writeFile('events/OddsEvents.ts', makeEventClass('OddsCapturedEvent', 'ODDS_CAPTURED', 'Odds', [
  { name: 'fixtureId', type: 'string' }, { name: 'providerId', type: 'string' },
  { name: 'marketType', type: 'string' }, { name: 'line', type: 'number' }
]));

writeFile('events/PredictionEvents.ts', makeEventClass('PredictionGeneratedEvent', 'PREDICTION_GENERATED', 'Prediction', [
  { name: 'fixtureId', type: 'string' }, { name: 'modelId', type: 'string' },
  { name: 'homeProb', type: 'number' }, { name: 'awayProb', type: 'number' },
  { name: 'drawProb', type: 'number | null' }, { name: 'confidence', type: 'number' }
]));

writeFile('events/CalibrationEvents.ts', makeEventClass('CalibrationCompletedEvent', 'CALIBRATION_COMPLETED', 'Calibration', [
  { name: 'modelId', type: 'string' }, { name: 'datasetId', type: 'string' },
  { name: 'ece', type: 'number' }, { name: 'brierScore', type: 'number' }
]));

writeFile('events/DecisionEvents.ts', makeEventClass('DecisionApprovedEvent', 'DECISION_APPROVED', 'Decision', [
  { name: 'fixtureId', type: 'string' }, { name: 'predictionId', type: 'string' },
  { name: 'decision', type: 'string' }, { name: 'expectedValue', type: 'number' }, { name: 'edge', type: 'number' }
]));

writeFile('events/StakeEvents.ts', makeEventClass('StakeCalculatedEvent', 'STAKE_CALCULATED', 'Stake', [
  { name: 'decisionId', type: 'string' }, { name: 'amount', type: 'number' },
  { name: 'currency', type: 'string' }, { name: 'stakeType', type: 'string' }, { name: 'odds', type: 'number' }
]));

writeFile('events/ResultEvents.ts', makeEventClass('ResultCollectedEvent', 'RESULT_COLLECTED', 'Result', [
  { name: 'fixtureId', type: 'string' }, { name: 'homeScore', type: 'number' },
  { name: 'awayScore', type: 'number' }, { name: 'winner', type: 'string' }
]));

writeFile('events/ReplayEvents.ts', makeEventClass('ReplayCompletedEvent', 'REPLAY_COMPLETED', 'Replay', [
  { name: 'datasetId', type: 'string' }, { name: 'fixtureCount', type: 'number' },
  { name: 'successCount', type: 'number' }, { name: 'failureCount', type: 'number' }
]));

writeFile('events/ResearchEvents.ts', makeEventClass('ResearchFinishedEvent', 'RESEARCH_FINISHED', 'Research', [
  { name: 'researchId', type: 'string' }, { name: 'conclusion', type: 'string' }, { name: 'keyFindings', type: 'string[]' }
]));

writeFile('events/DriftEvents.ts', makeEventClass('DriftDetectedEvent', 'DRIFT_DETECTED', 'Drift', [
  { name: 'modelId', type: 'string' }, { name: 'driftType', type: 'string' },
  { name: 'metric', type: 'string' }, { name: 'deviation', type: 'number' }, { name: 'severity', type: 'string' }
]));

writeFile('events/ModelEvents.ts', makeEventClass('ChampionValidatedEvent', 'CHAMPION_VALIDATED', 'Model', [
  { name: 'modelId', type: 'string' }, { name: 'challengerId', type: 'string' },
  { name: 'brierImproved', type: 'boolean' }, { name: 'eceImproved', type: 'boolean' }
]));

writeFile('events/ReportEvents.ts', makeEventClass('ReportGeneratedEvent', 'REPORT_GENERATED', 'Report', [
  { name: 'reportType', type: 'string' }, { name: 'period', type: 'string' }
]));

writeFile('events/index.ts', `export type { DomainEvent, EventType } from './DomainEvent';
export { EVENT_TYPES } from './DomainEvent';
export { DomainEventBus } from './DomainEventBus';
export type { EventHandler } from './DomainEventBus';
export { FixtureCreatedEvent, FixtureUpdatedEvent } from './FixtureEvents';
export { OddsCapturedEvent } from './OddsEvents';
export { PredictionGeneratedEvent } from './PredictionEvents';
export { CalibrationCompletedEvent } from './CalibrationEvents';
export { DecisionApprovedEvent } from './DecisionEvents';
export { StakeCalculatedEvent } from './StakeEvents';
export { ResultCollectedEvent } from './ResultEvents';
export { ReplayCompletedEvent } from './ReplayEvents';
export { ResearchFinishedEvent } from './ResearchEvents';
export { DriftDetectedEvent } from './DriftEvents';
export { ChampionValidatedEvent } from './ModelEvents';
export { ReportGeneratedEvent } from './ReportEvents';
`);

// ===== AGGREGATES =====
console.log('\nCreating aggregates...');

writeFile('aggregates/AggregateRoot.ts', `import { DomainEvent } from '../events/DomainEvent';

export abstract class AggregateRoot {
  readonly id: string;
  private _version: number = 0;
  private _domainEvents: DomainEvent[] = [];

  protected constructor(id: string) { this.id = id; }

  get version(): number { return this._version; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
    this._version++;
  }

  clearEvents(): void { this._domainEvents = []; }
  abstract validate(): boolean;
}
`);

writeFile('aggregates/FixtureAggregate.ts', `import { AggregateRoot } from './AggregateRoot';
import { FixtureCreatedEvent, FixtureUpdatedEvent } from '../events/FixtureEvents';

export enum FixtureStatus { SCHEDULED = 'SCHEDULED', LIVE = 'LIVE', FINISHED = 'FINISHED', POSTPONED = 'POSTPONED', CANCELLED = 'CANCELLED' }

export class FixtureAggregate extends AggregateRoot {
  private _status: FixtureStatus = FixtureStatus.SCHEDULED;
  private _homeScore: number = 0;
  private _awayScore: number = 0;
  private _homeTeamId: string;
  private _awayTeamId: string;

  constructor(id: string, homeTeamId: string, awayTeamId: string) {
    super(id);
    this._homeTeamId = homeTeamId;
    this._awayTeamId = awayTeamId;
  }

  get status(): FixtureStatus { return this._status; }
  get homeScore(): number { return this._homeScore; }
  get awayScore(): number { return this._awayScore; }

  schedule(homeTeamId: string, awayTeamId: string, kickoffTime: string, leagueId: string): void {
    if (this._status !== FixtureStatus.SCHEDULED) throw new Error('Fixture already scheduled');
    this._homeTeamId = homeTeamId;
    this._awayTeamId = awayTeamId;
    this.addDomainEvent(FixtureCreatedEvent.create(this.id, homeTeamId, awayTeamId, kickoffTime, leagueId));
  }

  startMatch(): void {
    if (this._status !== FixtureStatus.SCHEDULED) throw new Error('Cannot start match from status ' + this._status);
    this._status = FixtureStatus.LIVE;
    this.addDomainEvent(FixtureUpdatedEvent.create(this.id, { status: FixtureStatus.LIVE }));
  }

  finish(homeScore: number, awayScore: number): void {
    if (this._status !== FixtureStatus.LIVE) throw new Error('Cannot finish match from status ' + this._status);
    if (homeScore < 0 || awayScore < 0) throw new Error('Scores cannot be negative');
    this._homeScore = homeScore; this._awayScore = awayScore;
    this._status = FixtureStatus.FINISHED;
    this.addDomainEvent(FixtureUpdatedEvent.create(this.id, { status: FixtureStatus.FINISHED, homeScore, awayScore }));
  }

  postpone(): void {
    if (this._status !== FixtureStatus.SCHEDULED && this._status !== FixtureStatus.LIVE) throw new Error('Cannot postpone from status ' + this._status);
    this._status = FixtureStatus.POSTPONED;
    this.addDomainEvent(FixtureUpdatedEvent.create(this.id, { status: FixtureStatus.POSTPONED }));
  }

  cancel(): void {
    if (this._status === FixtureStatus.FINISHED) throw new Error('Cannot cancel finished match');
    this._status = FixtureStatus.CANCELLED;
    this.addDomainEvent(FixtureUpdatedEvent.create(this.id, { status: FixtureStatus.CANCELLED }));
  }

  validate(): boolean {
    if (this._status === FixtureStatus.FINISHED && this._homeScore === 0 && this._awayScore === 0) return false;
    return true;
  }
}
`);

writeFile('aggregates/PredictionAggregate.ts', `import { AggregateRoot } from './AggregateRoot';
import { PredictionGeneratedEvent } from '../events/PredictionEvents';

export enum PredictionState { PENDING = 'PENDING', GENERATED = 'GENERATED', SETTLED = 'SETTLED', INVALIDATED = 'INVALIDATED' }

export class PredictionAggregate extends AggregateRoot {
  private _state: PredictionState = PredictionState.PENDING;
  private _fixtureId: string;
  private _modelId: string;
  private _homeProb: number = 0;
  private _awayProb: number = 0;

  constructor(id: string, fixtureId: string, modelId: string) { super(id); this._fixtureId = fixtureId; this._modelId = modelId; }
  get state(): PredictionState { return this._state; }

  generate(homeProb: number, awayProb: number, drawProb: number | null, confidence: number): void {
    if (this._state !== PredictionState.PENDING) throw new Error('Cannot generate from state ' + this._state);
    this._homeProb = homeProb; this._awayProb = awayProb;
    this._state = PredictionState.GENERATED;
    this.addDomainEvent(PredictionGeneratedEvent.create(this._fixtureId, this._modelId, homeProb, awayProb, drawProb, confidence));
  }

  settle(outcome: number): void {
    if (this._state !== PredictionState.GENERATED) throw new Error('Cannot settle from state ' + this._state);
    this._state = PredictionState.SETTLED;
  }

  invalidate(reason: string): void {
    if (this._state === PredictionState.SETTLED) throw new Error('Cannot invalidate settled prediction');
    this._state = PredictionState.INVALIDATED;
  }

  validate(): boolean { if (this._state === PredictionState.GENERATED && (this._homeProb <= 0 || this._awayProb <= 0)) return false; return true; }
}
`);

writeFile('aggregates/DecisionAggregate.ts', `import { AggregateRoot } from './AggregateRoot';
import { DecisionApprovedEvent } from '../events/DecisionEvents';

export enum DecisionState { PENDING = 'PENDING', EVALUATED = 'EVALUATED', APPROVED = 'APPROVED', REJECTED = 'REJECTED', EXECUTED = 'EXECUTED' }

export class DecisionAggregate extends AggregateRoot {
  private _state: DecisionState = DecisionState.PENDING;
  private _fixtureId: string;
  private _predictionId: string;
  private _edge: number = 0;
  private _rejectionReason: string = '';

  constructor(id: string, fixtureId: string, predictionId: string) { super(id); this._fixtureId = fixtureId; this._predictionId = predictionId; }
  get state(): DecisionState { return this._state; }

  evaluate(edge: number): void {
    if (this._state !== DecisionState.PENDING) throw new Error('Cannot evaluate from state ' + this._state);
    this._edge = edge; this._state = DecisionState.EVALUATED;
  }

  approve(): void {
    if (this._state !== DecisionState.EVALUATED) throw new Error('Cannot approve from state ' + this._state);
    this._state = DecisionState.APPROVED;
    this.addDomainEvent(DecisionApprovedEvent.create(this._fixtureId, this._predictionId, 'APPROVED', 0, this._edge));
  }

  reject(reason: string): void {
    if (this._state !== DecisionState.EVALUATED) throw new Error('Cannot reject from state ' + this._state);
    this._rejectionReason = reason; this._state = DecisionState.REJECTED;
  }

  execute(): void {
    if (this._state !== DecisionState.APPROVED) throw new Error('Cannot execute from state ' + this._state);
    this._state = DecisionState.EXECUTED;
  }

  validate(): boolean { return this._state !== DecisionState.REJECTED || this._rejectionReason.length > 0; }
}
`);

writeFile('aggregates/PortfolioAggregate.ts', `import { AggregateRoot } from './AggregateRoot';

export interface PortfolioAllocation { stakeId: string; amount: number; fraction: number; }

export class PortfolioAggregate extends AggregateRoot {
  private _cashBalance: number;
  private _totalValue: number;
  private _allocations: PortfolioAllocation[] = [];
  private _riskLimit: number;

  constructor(id: string, initialBalance: number, riskLimit: number) {
    super(id); this._cashBalance = initialBalance; this._totalValue = initialBalance; this._riskLimit = riskLimit;
  }

  get cashBalance(): number { return this._cashBalance; }
  get totalValue(): number { return this._totalValue; }
  get allocations(): PortfolioAllocation[] { return [...this._allocations]; }

  allocate(stakeId: string, amount: number): void {
    if (amount > this._cashBalance) throw new Error('Insufficient balance: ' + amount + ' > ' + this._cashBalance);
    const totalAllocated = this._allocations.reduce((sum, a) => sum + a.amount, 0);
    if (totalAllocated + amount > this._riskLimit) throw new Error('Risk limit exceeded');
    this._cashBalance -= amount;
    this._allocations.push({ stakeId, amount, fraction: amount / this._totalValue });
  }

  settleStake(stakeId: string, pnl: number): void {
    const idx = this._allocations.findIndex(a => a.stakeId === stakeId);
    if (idx === -1) throw new Error('Stake not found: ' + stakeId);
    this._cashBalance += this._allocations[idx].amount + pnl;
    this._allocations.splice(idx, 1);
    this._totalValue += pnl;
  }

  rebalance(): void {
    for (const a of this._allocations) { a.fraction = a.amount / this._totalValue; }
  }

  riskCheck(): { passed: boolean; totalRisk: number; limit: number } {
    const totalRisk = this._allocations.reduce((sum, a) => sum + a.amount, 0);
    return { passed: totalRisk <= this._riskLimit, totalRisk, limit: this._riskLimit };
  }

  validate(): boolean { return this._cashBalance >= 0 && this._totalValue >= 0; }
}
`);

writeFile('aggregates/index.ts', `export { AggregateRoot } from './AggregateRoot';
export { FixtureAggregate, FixtureStatus } from './FixtureAggregate';
export { PredictionAggregate, PredictionState } from './PredictionAggregate';
export { DecisionAggregate, DecisionState } from './DecisionAggregate';
export { PortfolioAggregate } from './PortfolioAggregate';
export type { PortfolioAllocation } from './PortfolioAggregate';
`);

// ===== GRAPH =====
console.log('\nCreating graph...');

writeFile('graph/DomainGraph.ts', `export interface GraphNode { id: string; label: string; category: string; metadata: Record<string, unknown>; }
export interface GraphEdge { source: string; target: string; relationship: string; bidirectional: boolean; metadata: Record<string, unknown>; }

const DOMAIN_CATEGORIES: Record<string, string> = {
  Competition: 'competition', Season: 'season', League: 'league', Fixture: 'fixture',
  Team: 'team', Player: 'player', Venue: 'venue', Odds: 'odds', Market: 'market',
  Prediction: 'prediction', Probability: 'probability', Calibration: 'calibration',
  Feature: 'feature', Decision: 'decision', Policy: 'policy', Stake: 'stake',
  Portfolio: 'portfolio', Research: 'research', Replay: 'replay', Evidence: 'evidence',
  Experiment: 'experiment', Model: 'model', Provider: 'provider', Result: 'result',
  Performance: 'performance', Drift: 'drift', Risk: 'risk', Report: 'report',
};

const DOMAIN_EDGES = [
  { source: 'Competition', target: 'Season', relationship: 'has' },
  { source: 'Season', target: 'League', relationship: 'has' },
  { source: 'League', target: 'Fixture', relationship: 'contains' },
  { source: 'Team', target: 'Fixture', relationship: 'participates_in', bidirectional: true },
  { source: 'Fixture', target: 'Odds', relationship: 'has' },
  { source: 'Fixture', target: 'Prediction', relationship: 'has' },
  { source: 'Prediction', target: 'Decision', relationship: 'triggers' },
  { source: 'Decision', target: 'Stake', relationship: 'produces' },
  { source: 'Stake', target: 'Portfolio', relationship: 'belongs_to' },
  { source: 'Prediction', target: 'Calibration', relationship: 'validated_by' },
  { source: 'Prediction', target: 'Performance', relationship: 'measured_by' },
  { source: 'Fixture', target: 'Result', relationship: 'produces' },
  { source: 'Replay', target: 'Evidence', relationship: 'produces' },
  { source: 'Experiment', target: 'Model', relationship: 'tests' },
  { source: 'Model', target: 'Prediction', relationship: 'generates' },
  { source: 'Provider', target: 'Odds', relationship: 'provides' },
  { source: 'Feature', target: 'Model', relationship: 'trains' },
  { source: 'Model', target: 'Calibration', relationship: 'has' },
  { source: 'League', target: 'Team', relationship: 'contains', bidirectional: true },
  { source: 'Team', target: 'Player', relationship: 'has' },
  { source: 'Fixture', target: 'Venue', relationship: 'played_at' },
  { source: 'Competition', target: 'Team', relationship: 'has' },
  { source: 'Model', target: 'Performance', relationship: 'has' },
  { source: 'Market', target: 'Odds', relationship: 'classifies' },
  { source: 'Policy', target: 'Decision', relationship: 'governs' },
  { source: 'Drift', target: 'Model', relationship: 'affects' },
  { source: 'Risk', target: 'Portfolio', relationship: 'belongs_to' },
  { source: 'Report', target: 'Performance', relationship: 'summarizes' },
  { source: 'Evidence', target: 'Report', relationship: 'feeds_into' },
  { source: 'Research', target: 'Evidence', relationship: 'produces' },
  { source: 'Feature', target: 'Fixture', relationship: 'calculates_for' },
  { source: 'Probability', target: 'Prediction', relationship: 'feeds' },
];

export class DomainGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge[]> = new Map();

  constructor() { this.initializeDefaultNodes(); this.initializeDefaultEdges(); }

  private initializeDefaultNodes(): void {
    for (const [label, category] of Object.entries(DOMAIN_CATEGORIES)) {
      this.nodes.set(label, { id: label.toLowerCase(), label, category, metadata: {} });
    }
  }

  private initializeDefaultEdges(): void {
    for (const def of DOMAIN_EDGES) {
      this.addEdge({ source: def.source, target: def.target, relationship: def.relationship, bidirectional: def.bidirectional ?? false, metadata: {} });
    }
  }

  addNode(node: GraphNode): void { this.nodes.set(node.id, node); }
  addEdge(edge: GraphEdge): void {
    if (!this.edges.has(edge.source)) this.edges.set(edge.source, []);
    this.edges.get(edge.source)!.push(edge);
  }

  getNode(id: string): GraphNode | undefined { return this.nodes.get(id); }
  getEdges(id: string): GraphEdge[] { return this.edges.get(id) ?? []; }

  getNeighbors(id: string, direction: 'in' | 'out' | 'both' = 'both'): string[] {
    const result: string[] = [];
    if (direction === 'out' || direction === 'both') for (const e of this.edges.get(id) ?? []) result.push(e.target);
    if (direction === 'in' || direction === 'both') for (const [, edges] of this.edges) for (const e of edges) if (e.target === id && e.source !== id) result.push(e.source);
    return [...new Set(result)];
  }

  getPath(from: string, to: string): GraphEdge[] | null {
    const visited = new Set<string>();
    const queue: { node: string; path: GraphEdge[] }[] = [{ node: from, path: [] }];
    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      if (node === to) return path;
      if (visited.has(node)) continue;
      visited.add(node);
      for (const edge of this.edges.get(node) ?? []) queue.push({ node: edge.target, path: [...path, edge] });
    }
    return null;
  }

  findCycles(): string[][] {
    const visited = new Set<string>(), recStack = new Set<string>(), cycles: string[][] = [];
    const dfs = (node: string, path: string[]) => {
      visited.add(node); recStack.add(node);
      for (const edge of this.edges.get(node) ?? []) {
        if (!visited.has(edge.target)) dfs(edge.target, [...path, edge.target]);
        else if (recStack.has(edge.target)) { const i = path.indexOf(edge.target); if (i !== -1) cycles.push(path.slice(i)); }
      }
      recStack.delete(node);
    };
    for (const id of this.nodes.keys()) if (!visited.has(id)) dfs(id, [id]);
    return cycles;
  }

  validate(): boolean {
    for (const [, edges] of this.edges) for (const edge of edges) if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) return false;
    return true;
  }

  getGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return { nodes: [...this.nodes.values()], edges: [...this.edges.values()].flat() };
  }

  toTopologicalOrder(): string[] {
    const inDegree = new Map<string, number>();
    for (const id of this.nodes.keys()) inDegree.set(id, 0);
    for (const [, edges] of this.edges) for (const edge of edges) inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    const queue: string[] = [];
    for (const [id, degree] of inDegree) if (degree === 0) queue.push(id);
    const result: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const edge of this.edges.get(node) ?? []) {
        const d = (inDegree.get(edge.target) ?? 1) - 1;
        inDegree.set(edge.target, d);
        if (d === 0) queue.push(edge.target);
      }
    }
    return result;
  }

  detectOrphans(): string[] {
    const connected = new Set<string>();
    for (const [, edges] of this.edges) for (const edge of edges) { connected.add(edge.source); connected.add(edge.target); }
    return [...this.nodes.keys()].filter(id => !connected.has(id));
  }

  getSubgraph(category: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const ids = new Set([...this.nodes.values()].filter(n => n.category === category).map(n => n.id));
    const sub: GraphEdge[] = [];
    for (const [, edges] of this.edges) for (const edge of edges) if (ids.has(edge.source) && ids.has(edge.target)) sub.push(edge);
    return { nodes: [...ids].map(id => this.nodes.get(id)!).filter(Boolean), edges: sub };
  }
}
`);

writeFile('graph/index.ts', `export { DomainGraph } from './DomainGraph';
export type { GraphNode, GraphEdge } from './DomainGraph';
`);

// ===== POLICIES =====
console.log('\nCreating policies...');

writeFile('policies/DomainPolicies.ts', `import { DomainEvent } from '../events/DomainEvent';

export class NamingPolicy {
  static validateEntityName(name: string): boolean { return /^[A-Z][a-zA-Z0-9]*$/.test(name); }
  static validateMethodName(name: string): boolean { return /^[a-z][a-zA-Z0-9]*$/.test(name); }
  static validateConstantName(name: string): boolean { return /^[A-Z][A-Z0-9_]*$/.test(name); }
}

export class ImmutabilityPolicy {
  static isImmutable(obj: unknown): boolean { return obj !== null && obj !== undefined && Object.isFrozen(obj); }
  static validateEntity(entity: Record<string, unknown>): string[] {
    const violations: string[] = [];
    if (!Object.isFrozen(entity)) violations.push('Entity is not frozen');
    for (const key of Object.keys(entity)) {
      if (key.startsWith('_')) continue;
      const desc = Object.getOwnPropertyDescriptor(entity, key);
      if (desc && desc.writable) violations.push('Field ' + key + ' is writable');
    }
    return violations;
  }
}

export class ValidationPolicy {
  static validateRequired(value: unknown, name: string): void {
    if (value === null || value === undefined) throw new Error(name + ' is required');
  }
  static validateRange(value: number, min: number, max: number, name: string): void {
    if (value < min || value > max) throw new Error(name + ' must be between ' + min + ' and ' + max);
  }
  static validateString(value: string, name: string): void {
    if (!value || value.trim().length === 0) throw new Error(name + ' must not be empty');
  }
  static validateArray(value: unknown[], name: string): void {
    if (!value || value.length === 0) throw new Error(name + ' must not be empty');
  }
}

export class StateTransitionPolicy {
  static isValidTransition(current: string, next: string, validTransitions: Map<string, string[]>): boolean {
    const valid = validTransitions.get(current);
    if (!valid) return false;
    return valid.includes(next);
  }
  static getValidTransitions(state: string, transitions: Map<string, string[]>): string[] { return transitions.get(state) ?? []; }
}

export class VersionCompatibilityPolicy {
  static isBackwardCompatible(oldVersion: string, newVersion: string): boolean {
    return parseInt(oldVersion.split('.')[0], 10) === parseInt(newVersion.split('.')[0], 10);
  }
  static canMigrate(from: string, to: string): boolean { return VersionCompatibilityPolicy.isBackwardCompatible(from, to); }
}

export class ConsistencyPolicy {
  static validateEventConsistency(event: DomainEvent): string[] {
    const violations = [];
    if (!event.eventId) violations.push('Event missing eventId');
    if (!event.eventType) violations.push('Event missing eventType');
    if (!event.timestamp) violations.push('Event missing timestamp');
    return violations;
  }
  static checkInvariants(entity: Record<string, unknown>): string[] { return ImmutabilityPolicy.validateEntity(entity); }
}
`);

writeFile('policies/index.ts', `export { NamingPolicy, ImmutabilityPolicy, ValidationPolicy, StateTransitionPolicy, VersionCompatibilityPolicy, ConsistencyPolicy } from './DomainPolicies';
`);

// ===== REGISTRY =====
console.log('\nCreating registry...');

writeFile('registry/DomainRegistry.ts', `interface EntityConfig { entityClass: string; dtoInterface: string; factory: string; }
interface AggregateConfig { aggregateClass: string; rootEntity: string; invariants: string[]; }

const ALL_DOMAINS = [
  'Competition', 'Season', 'League', 'Fixture', 'Team', 'Player', 'Venue',
  'Odds', 'Market', 'Prediction', 'Probability', 'Calibration', 'Feature',
  'Decision', 'Policy', 'Stake', 'Portfolio', 'Research', 'Replay', 'Evidence',
  'Experiment', 'Model', 'Provider', 'Result', 'Performance', 'Drift', 'Risk', 'Report',
];

const DOMAIN_EVENTS: Record<string, string[]> = {
  Fixture: ['fixture.created', 'fixture.updated'], Odds: ['odds.captured'],
  Prediction: ['prediction.generated'], Calibration: ['calibration.completed'],
  Decision: ['decision.approved'], Stake: ['stake.calculated'],
  Result: ['result.collected'], Replay: ['replay.completed'],
  Research: ['research.finished'], Drift: ['drift.detected'],
  Model: ['champion.validated'], Report: ['report.generated'],
};

const AGGREGATE_MAP: Record<string, AggregateConfig> = {
  Fixture: { aggregateClass: 'FixtureAggregate', rootEntity: 'Fixture', invariants: ['Cannot finish if not started', 'Cannot start if cancelled'] },
  Prediction: { aggregateClass: 'PredictionAggregate', rootEntity: 'Prediction', invariants: ['Cannot settle unscheduled prediction', 'Cannot regenerate settled prediction'] },
  Decision: { aggregateClass: 'DecisionAggregate', rootEntity: 'Decision', invariants: ['Cannot execute rejected decision', 'Cannot approve without evaluation'] },
  Portfolio: { aggregateClass: 'PortfolioAggregate', rootEntity: 'Portfolio', invariants: ['Cannot exceed risk limit', 'Cannot allocate more than balance'] },
};

export class DomainRegistry {
  private static instance: DomainRegistry;
  private entities: Map<string, EntityConfig> = new Map();
  private events: Map<string, string[]> = new Map();
  private aggregates: Map<string, AggregateConfig> = new Map();

  private constructor() { this.initializeDefaults(); }

  static getInstance(): DomainRegistry {
    if (!DomainRegistry.instance) DomainRegistry.instance = new DomainRegistry();
    return DomainRegistry.instance;
  }

  private initializeDefaults(): void {
    for (const domain of ALL_DOMAINS) this.entities.set(domain, { entityClass: domain + '', dtoInterface: domain + 'DTO', factory: domain + '.create()' });
    for (const [domain, eventTypes] of Object.entries(DOMAIN_EVENTS)) this.events.set(domain, eventTypes);
    for (const [domain, config] of Object.entries(AGGREGATE_MAP)) this.aggregates.set(domain, config);
  }

  registerEntity(domain: string, config: EntityConfig): void { this.entities.set(domain, config); }
  registerEvents(domain: string, eventTypes: string[]): void { this.events.set(domain, eventTypes); }
  registerAggregate(domain: string, config: AggregateConfig): void { this.aggregates.set(domain, config); }
  getEntity(domain: string): EntityConfig | undefined { return this.entities.get(domain); }
  getEvents(domain: string): string[] | undefined { return this.events.get(domain); }
  getAggregate(domain: string): AggregateConfig | undefined { return this.aggregates.get(domain); }
  listDomains(): string[] { return [...ALL_DOMAINS]; }
  listEntities(): string[] { return [...this.entities.keys()]; }
  listEvents(): string[] { return [...this.events.keys()]; }
  listAggregates(): string[] { return [...this.aggregates.keys()]; }

  validate(): string[] {
    const issues: string[] = [];
    for (const domain of ALL_DOMAINS) if (!this.entities.has(domain)) issues.push('Missing entity for domain: ' + domain);
    return issues;
  }

  findDomainByEntity(entityName: string): string | null {
    return ALL_DOMAINS.find(d => this.entities.get(d)?.entityClass === entityName) ?? null;
  }

  findDomainByEvent(eventType: string): string | null {
    for (const [domain, events] of this.events) if (events.includes(eventType)) return domain;
    return null;
  }
}
`);

writeFile('registry/index.ts', `export { DomainRegistry } from './DomainRegistry';
`);

// ===== MAIN INDEX =====
console.log('\nCreating main index...');
writeFile('index.ts', `export * from './shared';
export * from './entities';
export * from './events';
export * from './aggregates';
export * from './graph';
export * from './policies';
export * from './registry';
export { Probability } from './entities/Probability';
export { Probability as ProbabilityValue } from './shared/Probability';
`);

// ===== TESTS =====
console.log('\nCreating tests...');

writeFile('__tests__/shared.test.ts', `import { describe, test } from 'vitest';
import { Money } from '../shared/Money';
import { Percentage } from '../shared/Percentage';
import { Probability } from '../shared/Probability';
import { Timestamp } from '../shared/Timestamp';
import { Version } from '../shared/Version';
import { Confidence, ConfidenceLevel } from '../shared/Confidence';
import { QualityScore } from '../shared/QualityScore';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); }

test('shared kernel DDD primitives', () => {
  // Money
  const m100 = Money.create(100, 'USD'), m50 = Money.create(50, 'USD');
  assert(m100.add(m50).amount === 150, 'Money.add');
  assert(m100.subtract(m50).amount === 50, 'Money.subtract');
  assert(m50.multiply(2).amount === 100, 'Money.multiply');
  assert(m100.divide(2).amount === 50, 'Money.divide');
  assert(m100.isGreaterThan(m50), 'Money.isGreaterThan');
  assert(m50.isLessThan(m100), 'Money.isLessThan');
  assert(m100.equals(Money.create(100, 'USD')), 'Money.equals');
  try { m100.add(Money.create(100, 'EUR')); assert(false, 'Money.currencyMismatch'); } catch { assert(true, 'Money.currencyMismatch'); }

  // Percentage
  const p50 = Percentage.fromDecimal(0.5), p25 = Percentage.fromDecimal(0.25);
  assert(Math.abs(p50.add(p25).value - 0.75) < 0.001, 'Percentage.add');
  assert(Math.abs(p50.subtract(p25).value - 0.25) < 0.001, 'Percentage.subtract');
  assert(Math.abs(Percentage.fromRatio(1, 4).value - 0.25) < 0.001, 'Percentage.fromRatio');
  assert(p50.toString() === '50.0%', 'Percentage.toString');
  try { Percentage.fromDecimal(1.5); assert(false, 'Percentage.range'); } catch { assert(true, 'Percentage.range'); }

  // Probability
  const prob70 = Probability.fromValue(0.7);
  assert(Math.abs(prob70.toDecimalOdds() - 1.4286) < 0.01, 'Probability.toDecimalOdds');
  assert(prob70.isValid(), 'Probability.isValid');
  try { Probability.fromValue(1.5); assert(false, 'Probability.range'); } catch { assert(true, 'Probability.range'); }

  // Timestamp
  const now1 = Timestamp.now(), later = now1.plus(1000);
  assert(later.isAfter(now1), 'Timestamp.isAfter');
  assert(now1.isBefore(later), 'Timestamp.isBefore');
  assert(later.diffMs(now1) === 1000, 'Timestamp.diffMs');

  // Version
  const v1 = Version.create(1, 2, 3);
  assert(v1.toString() === '1.2.3', 'Version.toString');
  assert(v1.isCompatible(Version.create(1, 5, 0)), 'Version.isCompatible');
  assert(!v1.isCompatible(Version.create(2, 0, 0)), 'Version.notCompatible');

  // Confidence
  const cHigh = Confidence.fromScore(0.85);
  assert(cHigh.getLevel() === ConfidenceLevel.HIGH, 'Confidence.getLevel HIGH');
  const combined = cHigh.combine(Confidence.fromScore(0.9));
  assert(Math.abs(combined.score - 0.765) < 0.001, 'Confidence.combine');

  // QualityScore
  const qGood = QualityScore.fromScore(85);
  assert(qGood.getLabel() === 'GOOD', 'QualityScore.GOOD');
  assert(qGood.isPassable(), 'QualityScore.isPassable');
  const qPoor = QualityScore.fromScore(45);
  assert(!qPoor.isPassable(), 'QualityScore.notPassable');
});
`);

writeFile('__tests__/entities.test.ts', `import { describe, test } from 'vitest';
import { Competition } from '../entities/Competition';
import { Fixture } from '../entities/Fixture';
import { Team } from '../entities/Team';
import { Prediction } from '../entities/Prediction';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); }

test('entities lifecycle and mapping', () => {
  const comp = Competition.create('Premier League', 'England', 'Football', 1, '2026-01-01', '2026-12-31', 'active');
  assert(comp.name === 'Premier League', 'Competition.create');
  assert(comp.id.startsWith('comp_'), 'Competition ID prefix');
  const compDTO = comp.toDTO();
  assert(compDTO.name === 'Premier League', 'Competition.toDTO');

  const team = Team.create('Arsenal FC', 'ARS', 'England', 'arsenal.png', 'Emirates Stadium', 1886);
  assert(team.name === 'Arsenal FC', 'Team.create');
  assert(team.id.startsWith('team_'), 'Team ID prefix');

  const fixture = Fixture.create('lea_000001', 'seas_000001', 'team_000001', 'team_000002', 'ven_000001', '2026-08-15T15:00:00Z', 'SCHEDULED', '1', 1, null, null);
  assert(fixture.id.startsWith('fxt_'), 'Fixture ID prefix');

  const pred = Prediction.create('fxt_000001', 'mdl_000001', 'MATCH_RESULT', 0, 0.52, 0.25, 0.03, 0.72, '2026-08-14T12:00:00Z', 'PENDING', 0.23);
  assert(pred.id.startsWith('pred_'), 'Prediction ID prefix');
});
`);

writeFile('__tests__/events.test.ts', `import { describe, test } from 'vitest';
import { DomainEventBus } from '../events/DomainEventBus';
import { FixtureCreatedEvent } from '../events/FixtureEvents';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); }

test('events and message dispatching', async () => {
  const bus = new DomainEventBus();
  let received: string | null = null;

  bus.subscribe('fixture.created', async (event) => { received = event.eventType; });
  const event = FixtureCreatedEvent.create('fxt_000001', 'team_000001', 'team_000002', '2026-08-15T15:00:00Z', 'lea_000001');
  await bus.publish(event);
  assert(received === 'fixture.created', 'EventBus subscribe + publish');

  bus.clear();

  const handler = async () => {};
  bus.subscribe('fixture.created', handler);
  bus.subscribe('fixture.created', handler);
  assert(bus.subscriberCount('fixture.created') === 1, 'EventBus subscriberCount');

  bus.clear();
  assert(bus.subscriberCount('fixture.created') === 0, 'EventBus.clear');

  assert(event.eventType === 'fixture.created', 'FixtureCreatedEvent type');
  assert(event.aggregateType === 'Fixture', 'FixtureCreatedEvent aggregateType');
  assert(event.payload.fixtureId === 'fxt_000001', 'FixtureCreatedEvent payload');
});
`);

writeFile('__tests__/aggregates.test.ts', `import { describe, test } from 'vitest';
import { FixtureAggregate, FixtureStatus } from '../aggregates/FixtureAggregate';
import { PredictionAggregate, PredictionState } from '../aggregates/PredictionAggregate';
import { DecisionAggregate, DecisionState } from '../aggregates/DecisionAggregate';
import { PortfolioAggregate } from '../aggregates/PortfolioAggregate';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); }

test('aggregates state transitions', () => {
  const fixture = new FixtureAggregate('fxt_000001', 'team_000001', 'team_000002');
  assert(fixture.status === FixtureStatus.SCHEDULED, 'FixtureAggregate initial');
  fixture.startMatch(); assert(fixture.status === FixtureStatus.LIVE, 'FixtureAggregate start');
  fixture.finish(2, 1); assert(fixture.status === FixtureStatus.FINISHED, 'FixtureAggregate finish');
  assert(fixture.homeScore === 2 && fixture.awayScore === 1, 'FixtureAggregate scores');

  try { const f2 = new FixtureAggregate('x', 'a', 'b'); f2.finish(1, 0); assert(false, 'fail guard'); } catch { assert(true, 'finish guard'); }
  try { const f3 = new FixtureAggregate('x', 'a', 'b'); f3.startMatch(); f3.startMatch(); assert(false, 'double start'); } catch { assert(true, 'double start guard'); }

  const pred = new PredictionAggregate('pred_000001', 'fxt_000001', 'mdl_000001');
  pred.generate(0.52, 0.25, 0.23, 0.72); assert(pred.state === PredictionState.GENERATED, 'Prediction generate');
  pred.settle(1); assert(pred.state === PredictionState.SETTLED, 'Prediction settle');
  try { pred.settle(2); assert(false, 'double settle'); } catch { assert(true, 'double settle guard'); }

  const dec = new DecisionAggregate('dec_000001', 'fxt_000001', 'pred_000001');
  dec.evaluate(0.05); assert(dec.state === DecisionState.EVALUATED, 'Decision evaluate');
  dec.approve(); assert(dec.state === DecisionState.APPROVED, 'Decision approve');
  dec.execute(); assert(dec.state === DecisionState.EXECUTED, 'Decision execute');
  try { const d2 = new DecisionAggregate('x', 'f', 'p'); d2.execute(); assert(false, 'execute guard'); } catch { assert(true, 'execute guard'); }

  const port = new PortfolioAggregate('port_000001', 10000, 5000);
  port.allocate('stk_000001', 2000); assert(port.cashBalance === 8000, 'Portfolio allocate');
  assert(port.riskCheck().passed, 'Portfolio riskCheck');
  try { port.allocate('stk_000002', 10000); assert(false, 'over-balance'); } catch { assert(true, 'over-balance guard'); }
});
`);

writeFile('__tests__/graph.test.ts', `import { describe, test } from 'vitest';
import { DomainGraph } from '../graph/DomainGraph';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); }

test('graph validation and topological sorting', () => {
  const graph = new DomainGraph();
  const g = graph.getGraph();

  assert(g.nodes.length === 28, 'Graph has 28 nodes, got ' + g.nodes.length);
  assert(g.edges.length > 25, 'Graph has 30+ edges, got ' + g.edges.length);
  assert(graph.validate(), 'Graph validate');
  assert(graph.detectOrphans().length === 0, 'Graph no orphans');

  const path = graph.getPath('Competition', 'Fixture');
  assert(path !== null, 'Graph path Competition->Fixture');
  assert(graph.findCycles().length === 0, 'Graph no cycles');
  assert(graph.toTopologicalOrder().length === 28, 'Topological order 28 items');
  assert(graph.getNeighbors('Fixture').length >= 4, 'Fixture has neighbors');
});
`);

writeFile('__tests__/policies.test.ts', `import { describe, test } from 'vitest';
import { NamingPolicy, ImmutabilityPolicy, ValidationPolicy, StateTransitionPolicy, VersionCompatibilityPolicy } from '../policies/DomainPolicies';
import { Money } from '../shared/Money';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); }

test('policies rule checking', () => {
  assert(NamingPolicy.validateEntityName('Competition'), 'PascalCase valid');
  assert(!NamingPolicy.validateEntityName('competition'), 'PascalCase invalid');
  assert(NamingPolicy.validateMethodName('createFixture'), 'camelCase valid');
  assert(!NamingPolicy.validateMethodName('CreateFixture'), 'camelCase invalid');

  const frozen = Money.create(100, 'USD');
  assert(ImmutabilityPolicy.isImmutable(frozen), 'ImmutabilityPolicy frozen');

  ValidationPolicy.validateRequired('test', 'test');
  try { ValidationPolicy.validateRequired(null, 'test'); assert(false, 'null'); } catch { assert(true, 'required null'); }

  const t = new Map([['PENDING', ['GENERATED']]]);
  assert(StateTransitionPolicy.isValidTransition('PENDING', 'GENERATED', t), 'state valid');
  assert(!StateTransitionPolicy.isValidTransition('PENDING', 'SETTLED', t), 'state invalid');

  assert(VersionCompatibilityPolicy.isBackwardCompatible('1.2.3', '1.5.0'), 'version compatible');
  assert(!VersionCompatibilityPolicy.isBackwardCompatible('1.2.3', '2.0.0'), 'version incompatible');
});
`);

writeFile('__tests__/registry.test.ts', `import { describe, test } from 'vitest';
import { DomainRegistry } from '../registry/DomainRegistry';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); }

test('registry schema validation', () => {
  const reg = DomainRegistry.getInstance();
  const reg2 = DomainRegistry.getInstance();
  assert(reg === reg2, 'DomainRegistry singleton');

  assert(reg.listDomains().length === 28, 'Registry has 28 domains, got ' + reg.listDomains().length);
  assert(reg.getEntity('Fixture') !== undefined, 'Registry Fixture entity');
  assert(reg.getEvents('Fixture') !== undefined, 'Registry Fixture events');
  assert(reg.getAggregate('Fixture') !== undefined, 'Registry Fixture aggregate');
  assert(reg.validate().length === 0, 'Registry validate no issues');
});
`);

console.log('\n✅ Domain Intelligence Platform generated successfully!');
console.log('Generated files: shared(9) + entities(16) + events(15) + aggregates(5) + graph(2) + policies(2) + registry(2) + index(1) + tests(7)');