import { DomainEvent } from '../events/DomainEvent';

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
