/**
 * DuckDB Server-Side Adapter
 * Interfaces with optional native DuckDB bindings when present in server execution environments.
 */

interface DuckDBConnection {
  all(sql: string, callback: (err: Error | null, res: any[]) => void): void;
  exec(sql: string, callback: (err: Error | null) => void): void;
  close(): void;
}

interface DuckDBDatabase {
  connect(): DuckDBConnection;
  close(): void;
}

export class DuckDBAdapter {
  private db: DuckDBDatabase | null = null;
  private conn: DuckDBConnection | null = null;

  constructor(dbPath: string = ':memory:') {
    try {
      // Dynamic load to support edge runtime fallback when native DuckDB binary is omitted
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const duckdb = require('duckdb');
      this.db = new duckdb.Database(dbPath) as DuckDBDatabase;
      this.conn = this.db.connect();
    } catch {
      this.db = null;
      this.conn = null;
    }
  }

  public async query(sql: string): Promise<any[]> {
    if (!this.conn) return [];
    return new Promise((resolve, reject) => {
      this.conn!.all(sql, (err: Error | null, res: any[]) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
  }

  public async exec(sql: string): Promise<void> {
    if (!this.conn) return;
    return new Promise((resolve, reject) => {
      this.conn!.exec(sql, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public async exportToParquet(queryOrTable: string, outputPath: string): Promise<void> {
    if (!this.conn) return;
    const sql = `COPY (${queryOrTable}) TO '${outputPath}' (FORMAT PARQUET);`;
    await this.exec(sql);
  }

  public async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.conn) this.conn.close();
      if (this.db) this.db.close();
      resolve();
    });
  }
}
