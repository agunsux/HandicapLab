import { generateDailyReport } from '../lib/reports/forensic-engine';

async function testForensicReport() {
  console.log('🏁 Starting forensic report generation test...');
  try {
    const res = await generateDailyReport();
    console.log('✅ Forensic Report Engine ran successfully!');
    console.log('Result payload:', JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Forensic report test failed:', err.message);
    process.exit(1);
  }
}

testForensicReport();
