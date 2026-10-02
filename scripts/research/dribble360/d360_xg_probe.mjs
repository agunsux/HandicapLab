// TEMP PROBE — verifies whether the "vendor distortion" REJECT of the gross xG
// aggregates (expected_goals / expected_goals_conceded / expected_assists) is real.
import fs from 'node:fs';
import readline from 'node:readline';

const FILE = 'data/research/dribble360/harvest/team_matches_2023_2024.jsonl';
const LIMIT = 5000;

const acc = {
  rows: 0,
  egMinusOpenSet: [],
  egMinusNonpen: [],
  egMinusOpenSetFk: [],
  eaMinusOpenSet: [],
  egcMinusOppEg: [],
};

const num = (o, k) => (typeof o?.[k] === 'number' ? o[k] : null);

const rl = readline.createInterface({
  input: fs.createReadStream(FILE),
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  if (!line.trim() || acc.rows >= LIMIT) return;
  let o;
  try { o = JSON.parse(line); } catch { return; }
  const eg = num(o, 'expected_goals');
  if (eg === null && num(o, 'expected_goals_nonpenalty') === null) return;
  acc.rows += 1;

  const op = num(o, 'expected_goals_openplay');
  const sp = num(o, 'expected_goals_setplay');
  const fk = num(o, 'expected_goals_freekick');
  const npx = num(o, 'expected_goals_nonpenalty');

  if (eg !== null && op !== null && sp !== null) acc.egMinusOpenSet.push(eg - (op + sp));
  if (eg !== null && npx !== null) acc.egMinusNonpen.push(eg - npx);
  if (eg !== null && op !== null && sp !== null && fk !== null) acc.egMinusOpenSetFk.push(eg - (op + sp + fk));

  const ea = num(o, 'expected_assists');
  const eao = num(o, 'expected_assists_openplay');
  const eas = num(o, 'expected_assists_setplay');
  if (ea !== null && eao !== null && eas !== null) acc.eaMinusOpenSet.push(ea - (eao + eas));
});

rl.on('close', () => {
  const stat = (arr) => {
    if (arr.length === 0) return 'n/a (no complete triples)';
    const srt = [...arr].sort((x, y) => x - y);
    const mean = arr.reduce((p, c) => p + c, 0) / arr.length;
    const tol = 1e-9;
    const exact0 = arr.filter((x) => Math.abs(x) < tol).length;
    const neg = arr.filter((x) => x < -tol).length;
    const pos = arr.filter((x) => x > tol).length;
    return `n=${arr.length} exact0=${exact0} (${((exact0 / arr.length) * 100).toFixed(2)}%) neg=${neg} pos=${pos} min=${srt[0].toFixed(4)} med=${srt[Math.floor(srt.length / 2)].toFixed(4)} max=${srt[srt.length - 1].toFixed(4)} mean=${mean.toFixed(4)}`;
  };
  console.log('rowsWithXg =', acc.rows);
  console.log('EG - (OP + SP)        :', stat(acc.egMinusOpenSet));
  console.log('EG - NPX              :', stat(acc.egMinusNonpen));
  console.log('EG - (OP + SP + FK)   :', stat(acc.egMinusOpenSetFk));
  console.log('EA - (EA_OP + EA_SP)  :', stat(acc.eaMinusOpenSet));
});
