// Cleanup: truncate research-sprint2.ts to first 30 lines
const fs = require('fs');
const p = __dirname + '/../scripts/research-sprint2.ts';
const c = fs.readFileSync(p, 'utf8');
const lines = c.split('\n');
fs.writeFileSync(p, lines.slice(0, 30).join('\n') + '\n');
console.log('Truncated to ' + Math.min(30, lines.length) + ' lines');
