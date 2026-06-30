import { supabase } from '../lib/supabase.server';
import * as fs from 'fs';
import * as path from 'path';

async function runAudit() {
  console.log('🚀 Running Production Data Integrity Check...');

  // Fetch signals
  const { data: signals, error } = await supabase
    .from('signals')
    .select('*');

  if (error) {
    console.error('❌ Failed to fetch signals:', error.message);
    process.exit(1);
  }

  const allSignals = signals || [];
  const reports: any[] = [];
  let passedCount = 0;
  let rejectedCount = 0;

  const rejectedReasons: Record<string, number> = {};

  allSignals.forEach(sig => {
    const errors: string[] = [];

    // Fields check
    if (!sig.match_id) errors.push('missing fixture_id');
    if (!sig.league) errors.push('missing league_id/name');
    if (!sig.kickoff_utc) errors.push('missing kickoff_time');
    if (!sig.market) errors.push('missing market_type');
    if (!sig.opening_reference_book) errors.push('missing reference_book');
    if (sig.odds === null || sig.odds === undefined) errors.push('missing opening_odds');
    if (!sig.prediction_created_at && !sig.created_at) errors.push('missing opening_timestamp');
    if (sig.probability === null || sig.probability === undefined) errors.push('missing model_probability');
    if (sig.fair_odds === null || sig.fair_odds === undefined) errors.push('missing fair_odds');

    // Rule-based guards
    if (sig.opening_reference_book !== 'PINNACLE' && sig.opening_reference_book !== 'SHARP' && sig.opening_reference_book !== 'AVERAGE_MARKET') {
      errors.push('missing reference bookmaker');
    }

    const kickoff = sig.kickoff_utc ? new Date(sig.kickoff_utc).getTime() : 0;
    const created = sig.prediction_created_at ? new Date(sig.prediction_created_at).getTime() : (sig.created_at ? new Date(sig.created_at).getTime() : 0);
    if (kickoff && created && created > kickoff) {
      errors.push('fixture started');
    }

    const isValid = errors.length === 0;

    if (isValid) {
      passedCount++;
    } else {
      rejectedCount++;
      errors.forEach(err => {
        rejectedReasons[err] = (rejectedReasons[err] || 0) + 1;
      });
    }

    reports.push({
      fixture_id: sig.match_id,
      league: sig.league,
      isValid,
      errors
    });
  });

  // Write artifact: validation_audit_report.md
  const artifactDir = 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\27513b68-a28e-4233-b6cc-97a3127946a0';
  const artifactPath = path.join(artifactDir, 'validation_audit_report.md');

  let markdownContent = `# Validation Audit Report\n\n`;
  markdownContent += `* **Total Audited Signals:** ${allSignals.length}\n`;
  markdownContent += `* **Passed Data Integrity:** ${passedCount}\n`;
  markdownContent += `* **Rejected / Incomplete:** ${rejectedCount}\n\n`;

  markdownContent += `## Rejection Reason Breakdown\n\n`;
  if (Object.keys(rejectedReasons).length > 0) {
    markdownContent += `| Reason | Count |\n|---|---|\n`;
    Object.entries(rejectedReasons).forEach(([reason, count]) => {
      markdownContent += `| ${reason} | ${count} |\n`;
    });
  } else {
    markdownContent += `*No signals were rejected. Perfect data integrity.*\n`;
  }

  markdownContent += `\n## Sample Audit Log (Recent 10 Signals)\n\n`;
  markdownContent += `| Fixture ID | League | Status | Details |\n|---|---|---|---|\n`;
  reports.slice(0, 10).forEach(row => {
    markdownContent += `| ${row.fixture_id} | ${row.league || '—'} | ${row.isValid ? '✅ PASS' : '❌ FAIL'} | ${row.errors.join(', ') || 'OK'} |\n`;
  });

  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(artifactPath, markdownContent, 'utf-8');

  console.log(`\n🎉 Audit report written successfully to ${artifactPath}`);
  process.exit(0);
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
