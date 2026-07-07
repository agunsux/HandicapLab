import { DatasetBuilder } from '../../../src/lib/data-platform/datasetBuilder';

/**
 * ARCH-001: Schema Corruption & Strict Enforcement
 * Bug Diuji: Pipeline sebelumnya meloloskan data dengan kolom wajib hilang atau tipe data salah.
 * Expected Result: PASS (Melempar Error dengan tipe FATAL)
 */

export async function testSchemaEnforcement(): Promise<boolean> {
  console.log('Running ARCH-001: Schema Corruption & Strict Enforcement');
  
  const badData = [
    {
      // Missing match_id
      competition_id: "EPL",
      season: "2024",
      date: "2024-01-01",
      home_team: "Arsenal",
      away_team: "Chelsea"
    }
  ];

  try {
    await DatasetBuilder.buildPartition(badData, 'EPL', '2024', 'v1.0', 'test_provider');
    console.error('❌ ARCH-001 FAILED: Expected Schema Drift Error but pipeline succeeded.');
    return false;
  } catch (err: any) {
    if (err.message.includes('Schema Drift Detected! Validation failed: row[0].match_id:')) {
      console.log('✅ ARCH-001 PASSED');
      return true;
    }
    console.error('❌ ARCH-001 FAILED: Wrong error message', err.message);
    return false;
  }
}

/**
 * ARCH-002: Business Validation
 * Bug Diuji: Pipeline menerima match dengan home_team == away_team atau negative goals.
 * Expected Result: PASS (Melempar Business Logic Violation)
 */
export async function testBusinessValidation(): Promise<boolean> {
  console.log('Running ARCH-002: Business Validation');
  
  const badData = [
    {
      match_id: "m_1",
      competition_id: "EPL",
      season: "2024",
      date: "2024-01-01",
      home_team: "Arsenal",
      away_team: "Arsenal", // Invalid
      home_goals: -1 // Invalid
    }
  ];

  try {
    await DatasetBuilder.buildPartition(badData, 'EPL', '2024', 'v1.0', 'test_provider');
    console.error('❌ ARCH-002 FAILED: Expected Business Logic Violation but pipeline succeeded.');
    return false;
  } catch (err: any) {
    if (err.message.includes('Business Logic Violation')) {
      console.log('✅ ARCH-002 PASSED');
      return true;
    }
    console.error('❌ ARCH-002 FAILED: Wrong error message', err.message);
    return false;
  }
}

async function run() {
  const t1 = await testSchemaEnforcement();
  const t2 = await testBusinessValidation();
  if (!t1 || !t2) process.exit(1);
}

if (require.main === module) run();
