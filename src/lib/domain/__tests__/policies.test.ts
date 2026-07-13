import { describe, test } from 'vitest';
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
