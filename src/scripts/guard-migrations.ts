import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../supabase/migrations');

interface FKReference {
  file: string;
  fromTable: string;
  toTable: string;
}

interface TableDefinition {
  file: string;
  tableName: string;
}

function runGuard() {
  console.log('🛡️ Starting Supabase Schema Layer & Dependency Guard...');

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`❌ Migrations directory not found at: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  console.log(`Found ${files.length} migration files.`);

  const tablesDefined = new Map<string, TableDefinition>();
  const fksDetected: FKReference[] = [];
  let hasProfilesTable = false;
  let hasAuthTriggerMapping = false;

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. Detect Table Creation
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/gi;
    let match;
    while ((match = createTableRegex.exec(content)) !== null) {
      const tbl = match[1].toLowerCase();
      tablesDefined.set(tbl, { file, tableName: tbl });
      if (tbl === 'profiles' || tbl === 'user_profiles') {
        hasProfilesTable = true;
      }
    }

    // 2. Detect Auth Trigger Mapping
    if (content.includes('auth.users') && (content.includes('TRIGGER') || content.includes('trigger'))) {
      hasAuthTriggerMapping = true;
    }

    // 3. Detect Inline References
    const inlineRefRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?([a-zA-Z0-9_]+)["']?\s*\(([\s\S]*?)\);/gi;
    let tableBodyMatch;
    while ((tableBodyMatch = inlineRefRegex.exec(content)) !== null) {
      const fromTable = tableBodyMatch[1].toLowerCase();
      const body = tableBodyMatch[2];
      
      const refRegex = /REFERENCES\s+(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/gi;
      let refMatch;
      while ((refMatch = refRegex.exec(body)) !== null) {
        const toTable = refMatch[1].toLowerCase();
        if (toTable !== 'auth' && toTable !== 'users') {
          fksDetected.push({ file, fromTable, toTable });
        }
      }
    }

    // 4. Detect ALTER TABLE ADD CONSTRAINT FOREIGN KEY
    const alterRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?["']?([a-zA-Z0-9_]+)["']?\s+ADD\s+CONSTRAINT\s+["']?[a-zA-Z0-9_]+["']?\s+FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/gi;
    while ((match = alterRegex.exec(content)) !== null) {
      const fromTable = match[1].toLowerCase();
      const toTable = match[2].toLowerCase();
      if (toTable !== 'auth' && toTable !== 'users') {
        fksDetected.push({ file, fromTable, toTable });
      }
    }
  }

  let ok = true;

  // Rule 1: Canonical profile table must exist
  if (!hasProfilesTable) {
    console.error(`❌ Guard Violation: Canonical 'profiles' table is missing from migrations.`);
    ok = false;
  }

  // Rule 2: Auth trigger mapping to profiles must be present
  if (!hasAuthTriggerMapping) {
    console.error(`❌ Guard Violation: Auth trigger mapping (auth.users -> profiles) is missing.`);
    ok = false;
  }

  // Rule 3: No broken foreign keys (pointing to tables that do not exist yet)
  for (const fk of fksDetected) {
    if (!tablesDefined.has(fk.toTable)) {
      console.error(`❌ Guard Violation: Foreign Key in '${fk.file}' points to a non-existent table '${fk.toTable}'.`);
      ok = false;
    } else {
      // Check if the referenced table is defined in a subsequent file
      const targetDef = tablesDefined.get(fk.toTable)!;
      if (files.indexOf(fk.file) < files.indexOf(targetDef.file)) {
        console.error(`❌ Guard Violation: Forward Reference Error in '${fk.file}'. Table '${fk.fromTable}' references '${fk.toTable}', which is defined in a later migration file '${targetDef.file}'.`);
        ok = false;
      }
    }
  }

  // Rule 4: Cycle detection
  const adj = new Map<string, string[]>();
  for (const fk of fksDetected) {
    if (!adj.has(fk.fromTable)) adj.set(fk.fromTable, []);
    adj.get(fk.fromTable)!.push(fk.toTable);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();
  let hasCycle = false;

  function dfs(node: string, path: string[]) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, path);
      } else if (recStack.has(neighbor)) {
        const startIndex = path.indexOf(neighbor);
        const cycle = path.slice(startIndex);
        cycle.push(neighbor);
        console.error(`❌ Guard Violation: Circular Dependency Detected: ${cycle.join(' -> ')}`);
        hasCycle = true;
        ok = false;
      }
    }

    recStack.delete(node);
    path.pop();
  }

  for (const table of tablesDefined.keys()) {
    if (!visited.has(table)) {
      dfs(table, []);
    }
  }

  if (ok) {
    console.log('✅ All schema layer validation rules passed successfully.');
    process.exit(0);
  } else {
    console.log('❌ Schema verification failed.');
    process.exit(1);
  }
}

runGuard();
