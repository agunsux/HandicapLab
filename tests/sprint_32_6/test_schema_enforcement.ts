import { DatasetBuilder } from '../../src/lib/data-platform/datasetBuilder';

export interface TestResult {
  name: string;
  passed: boolean;
  expected: 'error' | 'warning' | 'pass';
  actual: 'error' | 'warning' | 'pass';
  message?: string;
}

const BASE_VALID_RECORD = {
  match_id: 'm_123',
  competition_id: 'comp_1',
  season: '2024'
};

async function runTest(name: string, record: any, expected: 'error' | 'warning' | 'pass'): Promise<TestResult> {
  let actual: 'error' | 'warning' | 'pass' = 'pass';
  let message = '';
  
  try {
    await DatasetBuilder.buildPartition([record], 'EPL', '2024', 'v1', 'test_provider');
  } catch (error: any) {
    if (error.message.includes('Schema Drift Detected')) {
      actual = 'error';
    } else {
      actual = 'error';
    }
    message = error.message;
  }
  
  // Note: Warning is tricky to detect without intercepting console.warn, assuming pass if no throw
  // For the sake of this mock, we only expect error or pass for now

  return {
    name,
    expected,
    actual,
    passed: expected === actual,
    message
  };
}

export async function runSchemaTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // 1. Valid record
  results.push(await runTest('Valid Record', BASE_VALID_RECORD, 'pass'));

  // 2. Missing mandatory column
  const missingCol = { ...BASE_VALID_RECORD };
  delete (missingCol as any).competition_id;
  results.push(await runTest('Missing Mandatory Column (competition_id)', missingCol, 'error'));

  // 3. Renamed column
  const renamedCol = { match_id: 'm_123', comp_id_wrong: 'comp_1', season: '2024' };
  results.push(await runTest('Renamed Column', renamedCol, 'error'));

  // 4. Data type change (int -> string)
  const typeChange = { ...BASE_VALID_RECORD, season: 2024 }; // expected string, got number
  results.push(await runTest('Data Type Change (season: number)', typeChange, 'error'));

  // 5. Value out of range
  // Our schema is currently very loose (just strings), so this might pass right now
  const outOfRange = { ...BASE_VALID_RECORD, odds: 0.5, home_goals: -1 }; 
  results.push(await runTest('Value Out of Range (negative goals)', outOfRange, 'error')); // Ideally this should error

  // 6. Mandatory column is null
  const nullCol = { ...BASE_VALID_RECORD, competition_id: null };
  results.push(await runTest('Mandatory Column is Null', nullCol, 'error'));

  // 7. Unknown extra column
  const extraCol = { ...BASE_VALID_RECORD, extra_info: 'something' };
  results.push(await runTest('Unknown Extra Column', extraCol, 'error')); // In a strict schema, this might error

  return results;
}
