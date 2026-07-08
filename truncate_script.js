const fs = require('fs');
const p = 'C:/Users/RYZEN/.antigravity-ide/handicaplab/src/scripts/research-sprint2.ts';
let c = fs.readFileSync(p, 'utf8');
const target = "main().catch(e=>{console.error('[FATAL]',e);process.exit(1);});";
let count = 0, pos = 0, positions = [];
while ((pos = c.indexOf(target, pos)) !== -1) {
  positions.push(pos);
  count++;
  pos++;
}
console.log('COUNT:', count, 'POSITIONS:', JSON.stringify(positions));

const p = 'C:/Users/RYZEN/.antigravity-ide/handicaplab/src/scripts/research-sprint2.ts';
let c = fs.readFileSync(p, 'utf8');
console.log('BEFORE size:', c.length);
// Find the last occurrence of main().catch
const idx = c.lastIndexOf("main().catch(e=>{console.error('[FATAL]',e);process.exit(1);});");
if (idx >= 0) {
  const endIdx = idx + "main().catch(e=>{console.error('[FATAL]',e);process.exit(1);});".length;
  const clean = c.substring(0, endIdx);
  fs.writeFileSync(p, clean + '\n', 'utf8');
  console.log('AFTER size:', clean.length + 1);
} else {
  console.log('NOT FOUND');
  process.exit(1);
}
