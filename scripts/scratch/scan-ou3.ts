import * as fs from 'fs';
import * as path from 'path';

function scanFile(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (
      content.includes('"ouLine":3') ||
      content.includes('"ouLine": 3') ||
      content.includes('"ouLine":3.0') ||
      content.includes('"ouLine": 3.0') ||
      content.includes('"line":3.0') ||
      content.includes('"line": 3.0') ||
      content.includes('"OU3"') ||
      content.includes('over_3')
    ) {
      console.log('MATCH in:', filePath);
    }
  } catch (err) {}
}

function walkDir(dir: string) {
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const d of list) {
      const fullPath = path.join(dir, d.name);
      if (d.isDirectory() && !fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('.next')) {
        walkDir(fullPath);
      } else if (d.isFile() && (fullPath.endsWith('.json') || fullPath.endsWith('.jsonl') || fullPath.endsWith('.csv'))) {
        scanFile(fullPath);
      }
    }
  } catch (err) {}
}

walkDir('data');
walkDir('research');
console.log('Done scanning.');
