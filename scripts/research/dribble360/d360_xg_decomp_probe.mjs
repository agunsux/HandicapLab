#!/usr/bin/env node
/**
 * d360_xg_decomp_probe.mjs — read-only verification of the xG decomposition
 * identity claims made in DRIBBLE360_FEATURE_DECISION_MATRIX.md §3.3.
 *
 * Offline. No network. Reads at most MAX_ROWS rows of one harvested JSONL.
 *
 * Tests (per team-side row, only where all operands are non-null):
 *   A) nonpenalty            ?= openplay + setplay + freekick
 *   B) nonpenalty            ?= openplay + setplay            (freekick already inside setplay?)
 *   C) gross                 ?= nonpenalty + penalty
 *   D) gross                 ?= openplay + setplay + freekick + penalty
 *   E) assists               ?= assists_openplay + assists_setplay
 *   F) gross >= nonpenalty  (zero-tolerance monotonicity)
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const FILE = process.argv[2] ?? 'data/research/dribble360/harvest/team_matches_2023_2024.jsonl';
const MAX_ROWS = Number(process.argv[3] ?? 5000);
const EPS = 1e-6;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Recursively find the first object that carries any expected_* key. */
function findStats(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const it of node) {
      const r = findStats(it, depth + 1);
      if (r) return r;
    }
    return null;
  }
  const keys = Object.keys(node);
  if (keys.some((k) => k.startsWith('expected_'))) return node;
  for (const k of keys) {
    const r = findStats(node[k], depth + 1);
    if (r) return r;
  }
  return null;
}

const acc = {};
function tally(name, lhs, rhs, eps = EPS) {
  if (lhs === null || rhs === null) return;
  const a = (acc[name] ??= { n: 0, exact: 0, sumAbsDelta: 0, maxAbsDelta: 0, negatives: 0, worst: null });
  const d = lhs - rhs;
  a.n += 1;
  a.sumAbsDelta += Math.abs(d);
  if (Math.abs(d) <= eps) a.exact += 1;
  if (d < -eps) a.negatives += 1;
  if (Math.abs(d) > a.maxAbsDelta) {
    a.maxAbsDelta = Math.abs(d);
    a.worst = { lhs, rhs, delta: d };
  }
}

/** Equality after rounding both sides to the vendor's observed 4-dp grid. */
const r4 = (x) => Math.round(x * 1e4) / 1e4;
function tallyRounded(name, lhs, rhs) {
  if (lhs === null || rhs === null) return;
  const a = (acc[name] ??= { n: 0, exact: 0, sumAbsDelta: 0, maxAbsDelta: 0, negatives: 0, worst: null });
  const d = r4(lhs) - r4(rhs);
  a.n += 1;
  a.sumAbsDelta += Math.abs(d);
  if (d === 0) a.exact += 1;
  if (d < 0) a.negatives += 1;
  if (Math.abs(d) > a.maxAbsDelta) {
    a.maxAbsDelta = Math.abs(d);
    a.worst = { lhs: r4(lhs), rhs: r4(rhs), delta: d };
  }
}

const penaltyXg = { n: 0, zero: 0, sum: 0, max: 0, nonzeroValues: [], distinct: new Map() };

async function main() {
  const abs = path.resolve(FILE);
  const rl = readline.createInterface({ input: fs.createReadStream(abs), crlfDelay: Infinity });
  let rows = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const s = findStats(obj);
    if (!s) continue;
    rows += 1;

    const g = num(s.expected_goals);
    const np = num(s.expected_goals_nonpenalty);
    const op = num(s.expected_goals_openplay);
    const sp = num(s.expected_goals_setplay);
    const fk = num(s.expected_goals_freekick);
    const pen = g !== null && np !== null ? g - np : null;
    const a = num(s.expected_assists);
    const aop = num(s.expected_assists_openplay);
    const asp = num(s.expected_assists_setplay);

    const add = (...xs) => (xs.some((x) => x === null) ? null : xs.reduce((s2, x) => s2 + x, 0));

    tally('A_np=op+sp+fk', np, add(op, sp, fk));
    tally('B_np=op+sp', np, add(op, sp));
    tallyRounded('B4_np=op+sp (4dp)', np, add(op, sp));
    tally('E_assists=op+sp', a, add(aop, asp));
    tallyRounded('E4_assists=op+sp (4dp)', a, add(aop, asp));
    tally('F_penXg>=0 (gross-np)', g !== null && np !== null ? g - np : null, g !== null && np !== null ? 0 : null);

    if (g !== null && np !== null) {
      const p = g - np;
      penaltyXg.n += 1;
      penaltyXg.sum += p;
      if (Math.abs(p) <= 5e-5) penaltyXg.zero += 1;
      if (p > penaltyXg.max) penaltyXg.max = p;
      if (p > 5e-5 && penaltyXg.nonzeroValues.length < 12) penaltyXg.nonzeroValues.push(Number(p.toFixed(4)));
      if (p > 5e-5) {
        const k = Math.round(p / 0.7884);
        const key = `${Number(p.toFixed(4))}|k=${k}|exact=${Math.abs(p - k * 0.7884) <= 1e-4}`;
        penaltyXg.distinct.set(key, (penaltyXg.distinct.get(key) ?? 0) + 1);
      }
    }

    if (rows >= MAX_ROWS) break;
  }
  rl.close();

  console.log(`\nFile: ${path.relative(process.cwd(), abs)}   rows scanned: ${rows}\n`);
  console.log('Test'.padEnd(22), 'n'.padStart(7), 'exact%'.padStart(8), 'meanAbs'.padStart(10), 'maxAbs'.padStart(10), 'neg'.padStart(6));
  console.log('-'.repeat(68));
  for (const [name, a] of Object.entries(acc)) {
    const pct = a.n ? ((a.exact / a.n) * 100).toFixed(2) + '%' : 'n/a';
    console.log(
      name.padEnd(22),
      String(a.n).padStart(7),
      pct.padStart(8),
      (a.n ? (a.sumAbsDelta / a.n) : 0).toFixed(6).padStart(10),
      a.maxAbsDelta.toFixed(6).padStart(10),
      String(a.negatives).padStart(6),
    );
    if (a.worst && a.maxAbsDelta > EPS) console.log('    worst:', JSON.stringify(a.worst));
  }

  if (penaltyXg.n) {
    console.log(`\nPenalty-xG residual (gross − nonpenalty): n=${penaltyXg.n}`);
    console.log(`  exactly zero (<=5e-5): ${penaltyXg.zero} (${((penaltyXg.zero / penaltyXg.n) * 100).toFixed(2)}%)`);
    console.log(`  mean: ${(penaltyXg.sum / penaltyXg.n).toFixed(6)}   max: ${penaltyXg.max.toFixed(4)}`);
    console.log('  distinct nonzero values (value|k|exact -> count):');
    for (const [k, c] of [...penaltyXg.distinct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`    ${k} -> ${c}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
