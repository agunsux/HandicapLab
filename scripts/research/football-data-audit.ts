// ============================================================================
// CLI — football-data.co.uk SOURCE REALITY AUDIT (research only)
// ============================================================================
// Location: scripts/research/football-data-audit.ts
// Run: npm run research:fd:audit
//
// READ-ONLY with respect to production: the only write goes to
// data/research/football_data/ through the isolation guard.
// ============================================================================

import { auditSourceReality } from '../../src/research/football-data/sourceReality';
import { RESEARCH_ROOT, PRODUCTION_GOLD_DIR, repoRelative } from '../../src/research/football-data/researchPaths';

async function main() {
  const report = await auditSourceReality({ write: true });

  console.log('==========================================================');
  console.log('  FOOTBALL-DATA.CO.UK — SOURCE REALITY AUDIT (RESEARCH)');
  console.log('==========================================================');
  console.log(`generated_at : ${report.generated_at}`);
  console.log(`written to   : ${repoRelative(RESEARCH_ROOT)}/SOURCE_REALITY_AUDIT.json`);
  console.log(`production   : ${repoRelative(PRODUCTION_GOLD_DIR)} (UNTOUCHED, read-only)`);
  console.log('');

  console.log('## RAW SOURCE FILES (schema by generation)');
  console.log('| File | Season | Era | Cols | Rows | Pinn AH-O | Pinn AH-C | Pinn OU-O | Pinn OU-C |');
  console.log('| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |');
  for (const f of report.files) {
    console.log(
      `| ${f.file} | ${f.season} | ${f.era} | ${f.columns} | ${f.rows} | ` +
        `${f.pinnacle.ahOpen ? 'YES' : '-'} | ${f.pinnacle.ahClose ? 'YES' : '-'} | ` +
        `${f.pinnacle.ouOpen ? 'YES' : '-'} | ${f.pinnacle.ouClose ? 'YES' : '-'} |`
    );
  }
  console.log('');

  console.log('## MARKET AVAILABILITY (market × snapshot × provenance)');
  console.log('| Market | Snapshot | Provenance | Rows | Matches | Seasons | Verdict |');
  console.log('| --- | --- | --- | ---: | ---: | --- | --- |');
  for (const m of report.marketAvailability) {
    console.log(
      `| ${m.market} | ${m.snapshot} | ${m.provenance} | ${m.rows} | ${m.matches} | ` +
        `${m.seasons[0]}…${m.seasons[m.seasons.length - 1]} | ${m.mislabeledOrUntradeable ? '**DEFECT**' : 'genuine'} |`
    );
  }
  console.log('');

  console.log('## LINE INVENTORY');
  console.log('| Market | LineType | Line | Rows | Quarter? |');
  console.log('| --- | --- | ---: | ---: | --- |');
  for (const l of report.lineInventory) {
    console.log(`| ${l.market} | ${l.lineType} | ${l.line ?? '—'} | ${l.rows} | ${l.isQuarter ? 'YES' : '-'} |`);
  }
  console.log('');
  console.log(`OU distinct lines : [${report.ouDistinctLines.join(', ')}]`);
  console.log(`AH distinct lines : ${report.ahDistinctLines.length} (Pinnacle closing)`);
  console.log(`BTTS supported    : ${report.bttsSupported}`);
  console.log('');

  console.log('## FINDINGS');
  for (const f of report.findings) console.log(`- ${f}`);
  console.log('');
  console.log('## LIMITATIONS');
  for (const l of report.limitations) console.log(`- ${l}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
