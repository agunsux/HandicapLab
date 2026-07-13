import { DomainEventBus } from '../events/DomainEventBus';
import { FixtureCreatedEvent } from '../events/FixtureEvents';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); console.log('  ✅ ' + msg); }

async function test() {
  const bus = new DomainEventBus();
  let received: string | null = null;

  bus.subscribe('fixture.created', async (event) => { received = event.eventType; });
  const event = FixtureCreatedEvent.create('fxt_000001', 'team_000001', 'team_000002', '2026-08-15T15:00:00Z', 'lea_000001');
  await bus.publish(event);
  assert(received === 'fixture.created', 'EventBus subscribe + publish');

  bus.subscribe('fixture.created', async () => {});
  assert(bus.subscriberCount('fixture.created') === 1, 'EventBus subscriberCount');

  bus.clear();
  assert(bus.subscriberCount('fixture.created') === 0, 'EventBus.clear');

  assert(event.eventType === 'fixture.created', 'FixtureCreatedEvent type');
  assert(event.aggregateType === 'Fixture', 'FixtureCreatedEvent aggregateType');
  assert(event.payload.fixtureId === 'fxt_000001', 'FixtureCreatedEvent payload');

  console.log('\n✅ All event tests passed!');
}
test().catch(console.error);
