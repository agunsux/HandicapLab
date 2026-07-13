/**
 * HandicapLab Domain-Driven Design — Policy Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type PolicyType = 'staking' | 'risk' | 'selection' | 'validation' | 'calibration';

export interface PolicyDTO {
  id: string;
  name: string;
  description: string;
  policyType: PolicyType;
  rules: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

export class Policy {
  readonly id: string;
  readonly _name: string;
  readonly _description: string;
  readonly _policyType: PolicyType;
  readonly _rules: Record<string, unknown>;
  readonly _priority: number;
  readonly _enabled: boolean;
  readonly _effectiveFrom: string;
  readonly _effectiveTo?: string;

  private constructor(
    id: string,
    name: string,
    description: string,
    policyType: PolicyType,
    rules: Record<string, unknown>,
    priority: number,
    enabled: boolean,
    effectiveFrom: string,
    effectiveTo?: string
  ) {
    this.id = id;
    this._name = name;
    this._description = description;
    this._policyType = policyType;
    this._rules = rules;
    this._priority = priority;
    this._enabled = enabled;
    this._effectiveFrom = effectiveFrom;
    this._effectiveTo = effectiveTo;
    Object.freeze(this);
  }

  static create(
    name: string,
    description: string,
    policyType: PolicyType,
    rules: Record<string, unknown>,
    priority: number,
    enabled: boolean,
    effectiveFrom: string,
    effectiveTo?: string
  ): Policy {
    const id = generateId(ID_PREFIX.POLICY);
    return new Policy(id, name, description, policyType, rules, priority, enabled, effectiveFrom, effectiveTo);
  }

  static fromDTO(dto: PolicyDTO): Policy {
    return new Policy(dto.id, dto.name, dto.description, dto.policyType, dto.rules, dto.priority, dto.enabled, dto.effectiveFrom, dto.effectiveTo);
  }

  toDTO(): PolicyDTO {
    return {
      id: this.id,
      name: this._name,
      description: this._description,
      policyType: this._policyType,
      rules: this._rules,
      priority: this._priority,
      enabled: this._enabled,
      effectiveFrom: this._effectiveFrom,
      effectiveTo: this._effectiveTo
    };
  }

  get name(): string { return this._name; }
  get description(): string { return this._description; }
  get policyType(): PolicyType { return this._policyType; }
  get rules(): Record<string, unknown> { return this._rules; }
  get priority(): number { return this._priority; }
  get enabled(): boolean { return this._enabled; }
  get effectiveFrom(): string { return this._effectiveFrom; }
  get effectiveTo(): string | undefined { return this._effectiveTo; }

  equals(other: Policy): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._description === other._description &&
      this._policyType === other._policyType &&
      this._rules === other._rules &&
      this._priority === other._priority &&
      this._enabled === other._enabled &&
      this._effectiveFrom === other._effectiveFrom &&
      this._effectiveTo === other._effectiveTo;
  }

}
