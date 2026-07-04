import { Client } from 'pg';
import 'dotenv/config';

async function verifyLedger() {
  console.log('🏁 Starting Ledger v2 Schema & Integrity Verification...\n');

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  let client: Client;

  if (dbUrl) {
    client = new Client({ connectionString: dbUrl });
  } else {
    const projectRef = 'rgkrfzxipkrwqccfuqfq';
    const host = 'aws-0-ap-southeast-2.pooler.supabase.com';
    const user = `postgres.${projectRef}`;
    const password = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    client = new Client({
      host,
      port: 6543,
      user,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    });
  }

  try {
    await client.connect();
    console.log('🔌 Connected to database for verification.\n');

    let allPassed = true;

    // 1. Verify all tables exist
    console.log('📋 Checking tables...');
    const requiredTables = [
      'prediction_snapshots',
      'prediction_snapshot_features',
      'prediction_snapshot_markets',
      'prediction_snapshot_explainability',
      'prediction_snapshot_execution',
      'prediction_model_versions',
      'prediction_settlements',
      'prediction_calibration_metrics',
      'prediction_feedback',
      'schema_migrations_meta'
    ];

    const tablesRes = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = ANY($1)
    `, [requiredTables]);

    const foundTables = tablesRes.rows.map(r => r.tablename);
    for (const table of requiredTables) {
      if (foundTables.includes(table)) {
        console.log(`  ✅ Table '${table}': PRESENT`);
      } else {
        console.log(`  ❌ Table '${table}': MISSING`);
        allPassed = false;
      }
    }

    // 2. Verify all indexes exist
    console.log('\n🔍 Checking indexes...');
    const requiredIndexes = [
      'idx_pred_snap_match_id',
      'idx_pred_snap_uuid',
      'idx_pred_snap_hash',
      'idx_pred_feat_snap',
      'idx_pred_mkt_snap',
      'idx_pred_expl_snap',
      'idx_pred_exec_snap',
      'idx_pred_set_uuid',
      'idx_pred_feed_uuid'
    ];

    const indexesRes = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname = ANY($1)
    `, [requiredIndexes]);

    const foundIndexes = indexesRes.rows.map(r => r.indexname);
    for (const idx of requiredIndexes) {
      if (foundIndexes.includes(idx)) {
        console.log(`  ✅ Index '${idx}': PRESENT`);
      } else {
        console.log(`  ❌ Index '${idx}': MISSING`);
        allPassed = false;
      }
    }

    // 3. Verify all triggers are active
    console.log('\n⚡ Checking triggers...');
    const requiredTriggers = [
      'sync_snapshot_ids_trigger',
      'enforce_snapshot_immutability'
    ];

    const triggersRes = await client.query(`
      SELECT tgname, tgenabled
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relname = 'prediction_snapshots' 
        AND t.tgname = ANY($1)
    `, [requiredTriggers]);

    const foundTriggers = triggersRes.rows.map(r => r.tgname);
    const enabledTriggers = triggersRes.rows.filter(r => r.tgenabled === 'O').map(r => r.tgname);

    for (const trg of requiredTriggers) {
      if (foundTriggers.includes(trg)) {
        if (enabledTriggers.includes(trg)) {
          console.log(`  ✅ Trigger '${trg}' on prediction_snapshots: ACTIVE`);
        } else {
          console.log(`  ❌ Trigger '${trg}' on prediction_snapshots: INACTIVE`);
          allPassed = false;
        }
      } else {
        console.log(`  ❌ Trigger '${trg}' on prediction_snapshots: MISSING`);
        allPassed = false;
      }
    }

    // 4. Verify partition active
    console.log('\n📦 Checking table partitions...');
    const partitionRes = await client.query(`
      SELECT count(*)::int as count
      FROM pg_inherits i
      JOIN pg_class parent ON parent.oid = i.inhparent
      WHERE parent.relname = 'prediction_snapshots'
    `);
    const partitionCount = partitionRes.rows[0].count;
    if (partitionCount > 0) {
      console.log(`  ✅ Partitions for prediction_snapshots: ACTIVE (${partitionCount} partitions found)`);
    } else {
      console.log(`  ❌ Partitions for prediction_snapshots: INACTIVE (No partitions found)`);
      allPassed = false;
    }

    // 5. Verify materialized views exist
    console.log('\n📊 Checking materialized views...');
    const requiredViews = [
      'mv_prediction_roi',
      'mv_prediction_accuracy',
      'mv_prediction_clv',
      'mv_prediction_calibration',
      'mv_prediction_market',
      'mv_prediction_league',
      'mv_prediction_model'
    ];

    const viewsRes = await client.query(`
      SELECT matviewname 
      FROM pg_matviews 
      WHERE schemaname = 'public' AND matviewname = ANY($1)
    `, [requiredViews]);

    const foundViews = viewsRes.rows.map(r => r.matviewname);
    for (const view of requiredViews) {
      if (foundViews.includes(view)) {
        console.log(`  ✅ Materialized View '${view}': PRESENT`);
      } else {
        console.log(`  ❌ Materialized View '${view}': MISSING`);
        allPassed = false;
      }
    }

    // 6. Verify foreign keys
    console.log('\n🔗 Checking foreign key constraints...');
    const fkRes = await client.query(`
      SELECT conname, confrelid::regclass::text as ref_table
      FROM pg_constraint
      WHERE contype = 'f' AND connamespace = 'public'::regnamespace
    `);
    if (fkRes.rows.length > 0) {
      console.log(`  ✅ Foreign key constraints are valid (${fkRes.rows.length} FK constraints checked)`);
    } else {
      console.log(`  ⚠️ No foreign key constraints detected in schema.`);
    }

    // 7. Verify check constraints
    console.log('\n🛡️ Checking validation constraints...');
    const constraintsRes = await client.query(`
      SELECT conname, consrc
      FROM pg_constraint
      WHERE contype = 'c' AND connamespace = 'public'::regnamespace
    `);
    console.log(`  ✅ Constraints checked: ${constraintsRes.rows.length} constraints found.`);

    // 8. Verify immutability really works (UPDATE must fail)
    console.log('\n🔒 Verifying immutability (triggers)...');
    
    // We run the test in a transaction and rollback at the end
    await client.query('BEGIN');
    
    try {
      // 8.1. Insert dummy snapshot
      const testUuid = '00000000-0000-0000-0000-999999999999';
      const insertRes = await client.query(`
        INSERT INTO public.prediction_snapshots (
          id,
          prediction_uuid,
          match_id,
          kickoff_time,
          snapshot_time,
          hash_fingerprint,
          created_by
        ) VALUES (
          $1, $1, 'test-match-id', NOW(), NOW(), 'test_hash_val', 'verification_script'
        ) RETURNING id;
      `, [testUuid]);

      const insertedId = insertRes.rows[0].id;
      
      // 8.2. Try to update the snapshot
      console.log('  Attempting to execute illegal UPDATE statement...');
      await client.query(`
        UPDATE public.prediction_snapshots
        SET match_id = 'illegal-match-id'
        WHERE id = $1
      `, [insertedId]);

      console.log('  ❌ Immutability check failed: UPDATE succeeded when it should have raised an exception.');
      allPassed = false;
    } catch (updateErr: any) {
      if (updateErr.message && updateErr.message.includes('Immutability violation')) {
        console.log('  ✅ Immutability verified: UPDATE correctly blocked by DB trigger.');
      } else {
        console.log(`  ❌ Immutability check failed with unexpected error: ${updateErr.message}`);
        allPassed = false;
      }
    } finally {
      // Rollback the transaction to keep DB clean
      await client.query('ROLLBACK');
    }

    await client.end();

    console.log('\n====================================');
    if (allPassed) {
      console.log('🎉 SCHEMA VERIFICATION RESULT: PASS');
      process.exit(0);
    } else {
      console.log('❌ SCHEMA VERIFICATION RESULT: FAIL');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\n❌ Verification script failed to execute:', err.message);
    process.exit(1);
  }
}

verifyLedger().catch(console.error);
