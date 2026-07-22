/**
 * DuckDB Integration Smoke Test
 */

async function run() {
  console.log('Testing DuckDB binding...');
  
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const duckdb = require('duckdb');
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  
  conn.all('SELECT 1 AS success', (err: Error | null, res: any[]) => {
    if (err) {
      console.error('DuckDB error:', err);
      process.exit(1);
    } else {
      console.log('DuckDB successfully executed SELECT 1:', res);
      process.exit(0);
    }
  });
}

run();
