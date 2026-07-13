import { FixtureAggregate, FixtureStatus } from '../aggregates/FixtureAggregate';
import { PredictionAggregate, PredictionState } from '../aggregates/PredictionAggregate';
import { DecisionAggregate, DecisionState } from '../aggregates/DecisionAggregate';
import { PortfolioAggregate } from '../aggregates/PortfolioAggregate';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); console.log('  ✅ ' + msg); }

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

console.log('\n✅ All aggregate tests passed!');
