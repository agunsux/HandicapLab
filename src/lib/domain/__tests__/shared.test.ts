import { Money } from '../shared/Money';
import { Percentage } from '../shared/Percentage';
import { Probability } from '../shared/Probability';
import { Timestamp } from '../shared/Timestamp';
import { Version } from '../shared/Version';
import { Confidence, ConfidenceLevel } from '../shared/Confidence';
import { QualityScore } from '../shared/QualityScore';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); console.log('  ✅ ' + msg); }

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

console.log('\n✅ All shared kernel tests passed!');
