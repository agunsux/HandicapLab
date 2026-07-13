import { DomainRegistry } from '../registry/DomainRegistry';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); console.log('  ✅ ' + msg); }

const reg = DomainRegistry.getInstance();
const reg2 = DomainRegistry.getInstance();
assert(reg === reg2, 'DomainRegistry singleton');

assert(reg.listDomains().length === 28, 'Registry has 28 domains, got ' + reg.listDomains().length);
assert(reg.getEntity('Fixture') !== undefined, 'Registry Fixture entity');
assert(reg.getEvents('Fixture') !== undefined, 'Registry Fixture events');
assert(reg.getAggregate('Fixture') !== undefined, 'Registry Fixture aggregate');
assert(reg.validate().length === 0, 'Registry validate no issues');

console.log('\n✅ All registry tests passed!');
