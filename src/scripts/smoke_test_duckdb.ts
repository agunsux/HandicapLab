import duckdb from 'duckdb';

async function run() {
  console.log('Testing DuckDB binding...');
  
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  
  conn.all('SELECT 1 AS success', (err, res) => {
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
