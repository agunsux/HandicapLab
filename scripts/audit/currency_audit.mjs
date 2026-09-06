// Full Repository Currency Audit
// Searches all .ts, .tsx, .js, .jsx files in src/ for literal currency usage ($ or USD or dollar)
import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(process.cwd(), 'src');

function getAllFiles(dir, exts = ['.ts', '.tsx', '.js', '.jsx']) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== '.next') {
        files = files.concat(getAllFiles(fullPath, exts));
      }
    } else if (exts.includes(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getAllFiles(SRC_DIR);
console.log(`Auditing ${files.length} source files for currency usage...`);

const findings = [];

for (const f of files) {
  const relPath = path.relative(process.cwd(), f).replace(/\\/g, '/');
  const content = fs.readFileSync(f, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // 1. Literal $ not followed by { (or preceded by $ in template: e.g. `$${`)
    // Also look for `$` in JSX: e.g. <span>$</span> or ${...} preceded by $
    const hasDollarInTemplate = /\$\$\{/g.test(line);
    const hasDollarNotVar = /\$(?!\{)[0-9A-Za-z]/g.test(line) || />\s*\$\s*</.test(line) || />\s*\$/g.test(line) || /'\$'|"\\\$"/.test(line);
    const hasUsd = /\bUSD\b/i.test(line) && !/process\.env/i.test(line);
    const hasDollarWord = /\bdollars?\b/i.test(line);

    if (hasDollarInTemplate || hasDollarNotVar || hasUsd || hasDollarWord) {
      // Exclude obvious regex or bash/terminal commands or env vars
      if (line.includes('export const dynamic') || line.includes('import ') || line.includes('//')) {
        // Still check if comment or code
      }

      let category = 'UNKNOWN';
      let requiredChange = 'REVIEW';

      if (hasDollarInTemplate) {
        category = 'CURRENCY_FORMATTING_TEMPLATE';
        requiredChange = 'Replace `$` with Units `u`';
      } else if (/>\s*\$\s*</.test(line) || />\s*\$/g.test(line)) {
        category = 'JSX_CURRENCY_SYMBOL';
        requiredChange = 'Replace `$` with Units `u`';
      } else if (hasUsd) {
        category = 'USD_MENTION';
        requiredChange = line.includes('pricing') ? 'KEEP_PRICING' : 'Replace with Units if performance related';
      } else if (hasDollarWord) {
        category = 'DOLLAR_WORD';
        requiredChange = line.includes('pricing') ? 'KEEP_PRICING' : 'Replace with Units if performance related';
      } else {
        category = 'LITERAL_DOLLAR';
        requiredChange = 'Inspect context';
      }

      findings.push({
        file: relPath,
        line: lineNum,
        content: line.trim(),
        category,
        requiredChange
      });
    }
  }
}

const outPath = path.resolve(process.cwd(), 'reports', 'EPIC69_CURRENCY_AUDIT.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(findings, null, 2), 'utf-8');

console.log(`Found ${findings.length} potential currency occurrences.`);
console.log(`Detailed audit report written to: ${outPath}`);

// Summary by category
const summary = {};
for (const f of findings) {
  summary[f.category] = (summary[f.category] || 0) + 1;
}
console.log('Category Summary:', JSON.stringify(summary, null, 2));
