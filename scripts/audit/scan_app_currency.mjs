import * as fs from 'fs';
import * as path from 'path';

function scan(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.next') scan(p);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      const txt = fs.readFileSync(p, 'utf-8');
      const lines = txt.split('\n');
      lines.forEach((l, idx) => {
        // match literal dollar before number or in JSX or template
        if (/[+\->\s'"`]\$[0-9.{]/.test(l) || /['"]\$['"]/.test(l) || />\s*\$\s*</.test(l)) {
          console.log(p.replace(process.cwd(), '') + ':' + (idx + 1) + ' -> ' + l.trim());
        }
      });
    }
  }
}

console.log('=== APP DIRECTORY CURRENCY SCAN ===');
scan(path.resolve('src/app'));
console.log('=== SCAN COMPLETE ===');
