import fs from 'fs';
import path from 'path';

const forbidden = ['PSV', 'Ajax', '0.183', '+2.4%', '3.2%'];
let found: string[] = [];

function searchDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      searchDir(full);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      forbidden.forEach((p) => {
        if (content.includes(p)) {
          found.push(`${full} -> ${p}`);
        }
      });
    }
  }
}

searchDir(path.join('src', 'app'));
searchDir(path.join('src', 'components'));

console.log('MOCK_STRINGS_COUNT:', found.length);
if (found.length > 0) {
  console.log('MOCK_STRINGS_FOUND:', found);
} else {
  console.log('STEP 3 GREP PASSED: 0 forbidden mock strings in src/app and src/components.');
}
