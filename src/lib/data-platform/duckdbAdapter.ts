import duckdb from 'duckdb';

export class DuckDBAdapter {
  private db: duckdb.Database;
  private conn: duckdb.Connection;

  constructor(dbPath: string = ':memory:') {
    this.db = new duckdb.Database(dbPath);
    this.conn = this.db.connect();
  }

  public async query(sql: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(sql, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
  }

  public async exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  public async exportToParquet(queryOrTable: string, outputPath: string): Promise<void> {
      // DuckDB can export directly to parquet
      const sql = `COPY (${queryOrTable}) TO '${outputPath}' (FORMAT PARQUET);`;
      await this.exec(sql);
  }

  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      // close connection first
      this.conn.close();
      // then close DB instance
      this.db.close();
      resolve();
    });
  }
}
