import * as fs from 'fs';
import * as path from 'path';

function searchDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (file.endsWith('.json')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes('japan') || content.toLowerCase().includes('paraguay')) {
        console.log(`Found match in file: ${fullPath}`);
      }
    }
  }
}

console.log('Searching cache dir...');
searchDir('cache');
console.log('Done.');
