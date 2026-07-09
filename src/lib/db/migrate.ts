// Migration Runner — Migration-First Database Management
// No direct schema mutation. All changes go through numbered migrations.

import * as fs from 'fs';
import * as path from 'path';
import { query, transaction } from './connection';

const MIGRATIONS_TABLE = '_schema_migrations';
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

interface AppliedMigration {
  id: number;
  name: string;
  applied_at: string;
  hash: string;
}

async function ensureMigrationTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      hash VARCHAR(64) NOT NULL
    )
  `);
}

function fileHash(filePath: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export async function getAppliedMigrations(): Promise<AppliedMigration[]> {
  await ensureMigrationTable();
  const result = await query(`SELECT id, name, applied_at, hash FROM ${MIGRATIONS_TABLE} ORDER BY id ASC`);
  return result.rows;
}

export async function getPendingMigrations(): Promise<string[]> {
  const applied = new Set((await getAppliedMigrations()).map(m => m.name));
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  return files.filter(f => !applied.has(f));
}

export async function runMigrations(direction: 'up' | 'down' = 'up'): Promise<string[]> {
  await ensureMigrationTable();
  const applied = new Set((await getAppliedMigrations()).map(m => m.name));
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const ran: string[] = [];

  for (const file of files) {
    if (direction === 'up' && applied.has(file)) continue;
    if (direction === 'down' && !applied.has(file)) continue;

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const hash = fileHash(filePath);

    await transaction(async (tx) => {
      if (direction === 'up') {
        await tx(sql);
        await tx(
          `INSERT INTO ${MIGRATIONS_TABLE} (name, hash) VALUES ($1, $2)`,
          [file, hash]
        );
      } else {
        // Down migrations use a _down suffix file if available
        const downPath = filePath.replace(/\.sql$/, '.down.sql');
        if (fs.existsSync(downPath)) {
          const downSql = fs.readFileSync(downPath, 'utf8');
          await tx(downSql);
        }
        await tx(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [file]);
      }
    });

    ran.push(file);
  }

  return ran;
}

export async function migrateStatus(): Promise<{ applied: AppliedMigration[]; pending: string[] }> {
  const applied = await getAppliedMigrations();
  const pending = await getPendingMigrations();
  return { applied, pending };
}
