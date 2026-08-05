import fs from 'fs';
import path from 'path';

let violations: string[] = [];

function checkDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      checkDir(full);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      if (full.includes(path.join('src', 'app', 'api')) || full.includes(path.join('src', 'app', 'actions'))) continue;
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes("from('predictions')") ||
          content.includes('from("predictions")') ||
          content.includes('supabase.from')) {
        violations.push(full);
      }
    }
  }
}

checkDir(path.join('src', 'app'));
checkDir(path.join('src', 'components'));

console.log('VIOLATIONS_COUNT:', violations.length);
if (violations.length > 0) {
  console.log('VIOLATIONS_LIST:', violations);
} else {
  console.log('GREP GATE PASSED: 0 direct Supabase / table queries in UI pages or components.');
}
