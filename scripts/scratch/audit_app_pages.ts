import * as fs from 'fs';
import * as path from 'path';

function findPages(dir: string, list: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      findPages(full, list);
    } else if (e.name === 'page.tsx' || e.name === 'page.ts') {
      list.push(full);
    }
  }
  return list;
}

async function main() {
  const root = path.resolve(process.cwd(), 'src', 'app');
  const pages = findPages(root);

  const report: Array<{
    page: string;
    imports: string[];
    hasMockKeywords: boolean;
    hasMoneyline: boolean;
    hasHardcodedNumbers: boolean;
    dataSources: string[];
  }> = [];

  for (const p of pages) {
    const rel = path.relative(process.cwd(), p).replace(/\\/g, '/');
    const content = fs.readFileSync(p, 'utf8');
    const lines = content.split('\n');

    const imports = lines.filter(l => l.startsWith('import ')).map(l => l.trim());
    const hasMockKeywords = /mock|dummy|fake|sample|placeholder/i.test(content);
    const hasMoneyline = /moneyline|1x2/i.test(content);
    
    // Check data sources
    const dataSources: string[] = [];
    if (content.includes('supabase')) dataSources.push('supabase');
    if (content.includes('getTerminalPredictions')) dataSources.push('getTerminalPredictions');
    if (content.includes('getTerminalModels')) dataSources.push('getTerminalModels');
    if (content.includes('fetchTodayPicks')) dataSources.push('fetchTodayPicks');
    if (content.includes('DailyAhShadowPipeline')) dataSources.push('DailyAhShadowPipeline');

    report.push({
      page: rel,
      imports,
      hasMockKeywords,
      hasMoneyline,
      hasHardcodedNumbers: /\b\d+(\.\d+)?%\b/.test(content),
      dataSources
    });
  }

  console.log('App Pages Audit:');
  console.log(JSON.stringify(report, null, 2));

  fs.writeFileSync(
    path.resolve(process.cwd(), 'reports', 'APP_PAGES_REALITY_AUDIT.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );
}

main().catch(console.error);
