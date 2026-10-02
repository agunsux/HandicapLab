#!/usr/bin/env node
/**
 * emit-coverage-report.mjs
 * ---------------------------------------------------------------------------
 * Renders the COMMITTED, human-readable coverage deliverable
 *   docs/research/DRIBBLE360_FEATURE_COVERAGE.md
 * from the (gitignored) audit artefacts:
 *   data/research/dribble360/coverage/DRIBBLE360_FEATURE_COVERAGE.json
 *   data/research/dribble360/quality/DRIBBLE360_FEATURE_QUALITY.json
 *
 * Why a generator: the report namespace under data/ is gitignored and therefore
 * would not survive a fresh clone or the lapse of Elite access. This script is
 * committed, so the deliverable is reproducible from the artefacts at any time.
 * It performs NO network I/O and NO writes outside docs/research/.
 *
 * Usage: node scripts/research/dribble360/emit-coverage-report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const COV = 'data/research/dribble360/coverage/DRIBBLE360_FEATURE_COVERAGE.json';
const QUA = 'data/research/dribble360/quality/DRIBBLE360_FEATURE_QUALITY.json';
const OUT = 'docs/research/DRIBBLE360_FEATURE_COVERAGE.md';

const read = (p) => JSON.parse(fs.readFileSync(path.resolve(ROOT, p), 'utf8'));
const cov = read(COV);
const qua = read(QUA);

const mb = (b) => (b / 1024 / 1024).toFixed(1);
const pct = (x) => (x === null || x === undefined ? '—' : Number(x).toFixed(2) + '%');
const n = (x) => Number(x).toLocaleString('en-US');
const sha8 = (s) => (s ? s.slice(0, 8) + '…' : '—');

const cs = cov.corpusSummary;
const ms = qua.missingnessStructure;
const t = ms.totals;
const br = cov.canonicalBridge;
const L = [];
const w = (s = '') => L.push(s);

/* ------------------------------------------------------------------ header */
w('# Dribble360 Elite — Feature Coverage & Missingness Report');
w();
w(`**Generated:** ${cov.generatedAtUtc}  `);
w(`**Provider:** ${cov.provenance.provider} · **Entitlement:** ${cov.provenance.entitlement}  `);
w(`**Transport:** ${cov.provenance.transport}  `);
w(`**Audit script:** \`${cov.provenance.auditScript}\`  `);
w(`**Leakage policy:** \`${cov.provenance.leakagePolicy}\`  `);
w(`**Artefacts read:** \`${COV}\`, \`${QUA}\``);
w();
w('> This file is **generated** by `scripts/research/dribble360/emit-coverage-report.mjs`');
w('> from the audit artefacts. Do not hand-edit; re-run the generator. The');
w('> narrative interpretation lives in');
w('> `docs/providers/DRIBBLE360_SALMO_MAX_VALUE_REPORT.md`; per-feature dispositions');
w('> live in `docs/research/DRIBBLE360_FEATURE_DECISION_MATRIX.md`.');
w();
w('---');
w();

/* ---------------------------------------------------------- corpus summary */
w('## 1. Corpus Summary');
w();
w('| Metric | Value |');
w('|---|---|');
w(`| \`team_matches_*\` records scanned | **${n(cs.teamMatchRecordsScanned)}** |`);
w(`| Records accepted after dedup | **${n(cs.teamMatchRecordsAccepted)}** |`);
w(`| Duplicate \`(match_id, team_id)\` pairs dropped | ${n(cs.duplicatesDropped)} |`);
w(`| Unique matches | **${n(cs.uniqueMatches)}** |`);
w(`| Distinct teams | ${n(cs.teams)} |`);
w(`| Distinct fields observed | **${n(cs.fields)}** |`);
w(`| Season buckets observed | ${cs.seasonsObserved} |`);
w();

/* ------------------------------------------------------------ harvest files */
w('### 1.1 Harvest files');
w();
w('| File | Records | Size | SHA-256 (head) |');
w('|---|---|---|---|');
for (const [f, meta] of Object.entries(cs.harvestFiles)) {
  const recs = cs.perFile?.[f]?.records ?? 0;
  w(`| \`${f}\` | ${recs ? n(recs) : '**0**'} | ${mb(meta.bytes)} MB | \`${sha8(meta.sha256)}\` |`);
}
w();
const dup = cs.duplicateFileGroups ?? [];
if (dup.length) {
  w('> **Duplicate file group detected (not de-duplicated on disk).**');
  w('>');
  for (const g of dup) {
    const b = cs.harvestFiles[g.files[0]]?.bytes ?? 0;
    w(`> SHA-256 \`${g.sha256}\` is shared byte-for-byte by **${g.files.length}** files:`);
    w(`> ${g.files.map((x) => '`' + x + '`').join(', ')}.`);
    w(`> ~${mb(b * g.files.length)} MB is reclaimable — only the \`team_matches_*\` family`);
    w('> carries statistics.');
  }
  w();
}
w('> `team_matches_2019_2020.jsonl` is **0.0 MB / 0 records** — an empty harvest, not a');
w('> zero-activity season. See the max-value report for the re-fetch follow-up.');
w();
w('---');
w();

/* --------------------------------------------------------------- missingness */
w('## 2. Missingness — Record-Level, Not Field-Level');
w();
w('The headline distortion in any naive field-level read is that the gaps are not');
w('spread across columns; whole **records** arrive without a statistics block.');
w();
w(`Definition used: ${ms.definition.noCoreStats}.`);
w(`Core probe fields: ${ms.definition.coreProbeFields.map((f) => '`' + f + '`').join(', ')}.`);
w();
w('| Measure | Records | Share |');
w('|---|---|---|');
w(`| **No core stats at all** (empty block) | **${n(t.noCoreStats)}** | **${pct(t.pctNoStats)}** |`);
w(`| All core stats present | ${n(t.allCoreStats)} | ${pct(t.pctAllStats)} |`);
w(`| Partial core stats | ${n(t.partialCoreStats)} | ${pct((t.partialCoreStats / t.records) * 100)} |`);
w(`| Carrying \`expected_goals\` | ${n(t.withExpectedGoals)} | ${pct(t.pctXgPresent)} |`);
w(`| **Total scanned** | **${n(t.records)}** | 100.00% |`);
w();
w('### 2.1 Per file');
w();
w('| File | Records | No core stats | No-stats % | xG present % |');
w('|---|---|---|---|---|');
for (const [f, v] of Object.entries(ms.perFile)) {
  w(`| \`${f}\` | ${v.records ? n(v.records) : '**0**'} | ${n(v.noCoreStats)} | ${pct(v.pctNoStats)} | ${pct(v.pctXgPresent)} |`);
}
w();
w('> Missingness is **tier-correlated**, not random: it concentrates in');
w('> lower-division and cup fixtures. Within the Top-League whitelist the data is');
w('> materially complete (§4). Consequence: select or weight by `stats-present`;');
w('> do **not** blanket-impute.');
w();
w('---');
w();

/* ------------------------------------------------------------------- bridge */
w('## 3. Canonical Bridge — Golden ↔ Dribble');
w();
w('| Metric | Value |');
w('|---|---|');
w(`| Golden records available | ${n(br.goldenRecords)} |`);
w(`| Dribble **side-rows** bridged | **${n(br.bridgedRecords)}** |`);
w(`| Unbridged side-rows retained as \`UNBRIDGED\` | ${n(br.unbridgedRecords)} |`);
w(`| Bridge rate (side-rows) | **${pct(br.matchRatePct)}** |`);
w(`| **Unique bridged matches** | **${n(br.bridgedRecords / 2)}** |`);
w(`| Method | ${br.method} |`);
w();
w('> **Two units, one number.** The bridge stores **one entry per match** but counts');
w(`> \`bridged\`/\`unbridged\` in **side-rows**. Hence ${n(br.bridgedRecords)} = ${n(br.bridgedRecords / 2)} matches × 2 sides.`);
w('> Both figures are correct and must not be mixed.');
w();
w('> ⚠️ **Artefact defect, flagged not patched.** `canonicalBridge.matchedLeagues` is');
w(`> the **golden league census**, not the bridged distribution: ${Object.entries(br.matchedLeagues).map(([k, v]) => '`' + k + ': ' + v + '`').join(', ')}`);
w(`> — which sums to ${n(Object.values(br.matchedLeagues).reduce((a, b) => a + b, 0))} = the golden total. Read literally it implies a`);
w('> 5-league bridge, which is **false**. The true bridged distribution, computed from');
w('> the bridge records themselves, is **ENG-PL only, 579 matches**.');
w();
w('---');
w();

/* ------------------------------------------------------------------- matrix */
w('## 4. League × Season Coverage vs Golden');
w();
w('Every bridged cell is **ENG-PL**; every other harvested record is `UNBRIDGED`.');
w('`coverageVsGoldenPct` is only defined for bridged cells.');
w();
w('| League | Season | Side-rows | Unique matches | Golden available | Missing | Coverage |');
w('|---|---|---|---|---|---|---|');
for (const c of cov.coverageMatrix) {
  w(`| ${c.leagueId} | \`${c.season}\` | ${n(c.teamMatchRecords)} | ${n(c.uniqueMatches)} | ${c.goldenMatchesAvailable === null ? '—' : n(c.goldenMatchesAvailable)} | ${c.missingMatches === null ? '—' : n(c.missingMatches)} | ${c.coverageVsGoldenPct === null ? '—' : pct(c.coverageVsGoldenPct)} |`);
}
w();
w('> **Season-key format is inconsistent by construction.** Bridged cells inherit the');
w("> golden key format (`2020-2021`, hyphen); unbridged cells inherit Dribble's");
w('> (`2020_2021`, underscore), plus one `unknown` bucket. Normalise `-`/`_` before');
w('> using this matrix as a join key or cells will silently miss.');
w();
w('### 4.1 Completeness inside bridged EPL cells');
w();
const cells = cov.coverageMatrix.filter((c) => c.leagueId === 'ENG-PL');
const probe = Object.keys(cells[0].featureCompletenessPct);
w('| Field | Min across bridged cells | Max across bridged cells |');
w('|---|---|---|');
for (const p of probe) {
  const vals = cells.map((c) => c.featureCompletenessPct[p]).filter((v) => v !== null && v !== undefined);
  w(`| \`${p}\` | ${pct(Math.min(...vals))} | ${pct(Math.max(...vals))} |`);
}
w();
w('> `possession_percentage`, `ppda`, `sca` and `gca` are **0% in every bridged cell**');
w('> — genuinely absent from the vendor payload, not a bridge artefact.');
w();
w('---');
w();


/* ---------------------------------------------------------------- features */
w('## 5. Feature Disposition');
w();
w('| Class | Fields | Meaning |');
w('|---|---|---|');
const dc = cov.classificationCounts;
w(`| \`RESEARCH\` | **${dc.RESEARCH}** | Coverage ≥ 50%, not constant, no impossibility flag |`);
w(`| \`LICENSE_REVIEW_LOW_COVERAGE\` | ${dc.LICENSE_REVIEW_LOW_COVERAGE} | Coverage < 50%; retained but gated behind licensing review |`);
w(`| \`NOT_AVAILABLE\` | ${dc.NOT_AVAILABLE} | Always null across the entire corpus |`);
w(`| \`REJECT\` | ${dc.REJECT} | Identifiers, constants, or provably redundant values |`);
w(`| **Total** | **${cs.fields}** | |`);
w();
w('### 5.1 Leakage classes');
w();
w('| Class | Fields | Meaning |');
w('|---|---|---|');
w(`| \`PRE_MATCH_SAFE_AS_LAG\` | **${qua.leakageCounts.PRE_MATCH_SAFE_AS_LAG}** | **Current-match** value; pre-match-safe only after \`shift(1)\` within team |`);
w(`| \`POST_MATCH_ONLY\` | ${qua.leakageCounts.POST_MATCH_ONLY} | Outcome of the predicted match — prohibited as a feature |`);
w(`| \`N/A\` | ${qua.leakageCounts['N/A']} | Non-feature identifiers |`);
w();
w('> ⚠️ **`PRE_MATCH_SAFE_AS_LAG` does not mean "known before kickoff".** Every field in');
w('> that class is a *current-match* statistic; the provider emits nothing genuinely');
w('> known pre-kickoff. This is the highest-risk misreading in the dataset because all');
w('> **18 `expected_*` (xG/xA) fields** sit there. Same-match xG is a post-match');
w('> measurement — using it unlagged is direct target leakage. Lag by ≥1 fixture per');
w('> team. See the max-value report §5.2.');
w();
w('### 5.2 Highest-coverage fields');
w();
const byCov = [...cov.featureCoverage].sort((a, b) => b.coveragePct - a.coveragePct);
w('| # | Field | Coverage | Non-null | Class | Leakage |');
w('|---|---|---|---|---|---|');
byCov.slice(0, 20).forEach((f, i) => {
  w(`| ${i + 1} | \`${f.field}\` | ${pct(f.coveragePct)} | ${n(f.nonNullCount)} | ${f.decision} | ${f.leakageClass} |`);
});
w();
w('### 5.3 Nonzero but very sparse fields (bottom 15)');
w();
const sparse = cov.featureCoverage.filter((f) => f.coveragePct > 0).sort((a, b) => a.coveragePct - b.coveragePct);
w('| # | Field | Coverage | Class |');
w('|---|---|---|---|');
sparse.slice(0, 15).forEach((f, i) => w(`| ${i + 1} | \`${f.field}\` | ${pct(f.coveragePct)} | ${f.decision} |`));
w();
const zero = cov.featureCoverage.filter((f) => f.coveragePct === 0).map((f) => f.field);
w(`### 5.4 Zero-coverage fields (${zero.length})`);
w();
w('```');
for (let i = 0; i < zero.length; i += 4) w(zero.slice(i, i + 4).join(', '));
w('```');
w();
w(`> These are \`NOT_AVAILABLE\`: always null across all ${n(t.records)} scanned records.`);
w('> They are **not** sparse features and must not be imputed into existence. Note');
w('> `possession_percentage`, `ppda`, `sca`, `gca` and the whole');
w('> `expected_goals_ontarget*` family are among them.');
w();
w('### 5.5 Zero-coverage reconciliation — 43 / 42 / 1');
w();
const anl = qua.alwaysNullFields ?? [];
const flaggedAn = (qua.features ?? []).filter((f) => (f.qualityFlags || []).includes('ALWAYS_NULL')).map((f) => f.field);
const notAn = anl.filter((f) => !flaggedAn.includes(f));
w('Three different numbers describe the same population. Verified against the artefacts:');
w();
w('| Quantity | Value | Source of truth |');
w('|---|---|---|');
w(`| Fields at 0% coverage | **${zero.length}** | \`featureCoverage[*].coveragePct === 0\` / \`alwaysNullFields\` |`);
w(`| \`ALWAYS_NULL\` quality flags | ${qua.qualityFlagsCounts?.ALWAYS_NULL ?? 0} | \`qualityFlagsCounts.ALWAYS_NULL\` |`);
w(`| \`NOT_AVAILABLE\` class | ${dc.NOT_AVAILABLE} | \`classificationCounts.NOT_AVAILABLE\` |`);
w();
w(`> The gap of one is **${notAn.join(', ')}** — null in ${n(qua.features.find((f) => f.field === notAn[0])?.nullCount)} of ${n(t.records)} records, with **a single non-null`);
w('> observation** (value `1`). Because it is constant it carries the `CONSTANT` quality');
w('> flag instead of `ALWAYS_NULL`, so it is counted under `REJECT`. All three numbers');
w('> are therefore correct and none should be quoted without its definition.');
w();
w('> The 8 `CONSTANT` fields — `att_obp_goal`, `att_pen_miss`, `att_obox_own_goal`,');
w('> `back_pass`, `rescinded_red_card`, `six_second_violation`, `keeper_goals`,');
w('> `direct_setpiece_goals` — are all rare-event counters that never fire in this');
w('> corpus. They are **not** evidence that such events never occur.');
w();
w('---');
w();

/* ------------------------------------------------------------ hygiene notes */
w('## 6. Data-Quality Flags Carried Into Every Decision');
w();
w('| Flag | Fields | Consequence |');
w('|---|---|---|');
const flags = qua.qualityFlagsCounts ?? {};
const flagNote = {
  ALWAYS_NULL: 'Null in every record. Not a feature — classed `NOT_AVAILABLE` (see §5.5 for why this count is 42 while 43 fields sit at 0% coverage).',
  CONSTANT: 'Zero variance — carries no signal. Eight rare-event counters; see §5.5.',
  SCALE_INFLATION_X11: '**Unit defect.** Observed scale is 11× the semantic unit. Carried by `goals_conceded` alone.',
  IMPOSSIBLE_SINGLE_MATCH_VALUES: '**Unit defect.** Values that cannot occur in one match for the stated unit. Also carried by `goals_conceded` alone.',
  CHECK_EXTREME_MAX: 'Max is an outlier requiring a per-field judgement (e.g. `touches` max = 1,307; `total_final_third_passes` max = 540). Not automatically wrong — but must be winsorised or scaled before use.',
};
for (const [k, v] of Object.entries(flags)) w(`| \`${k}\` | ${v} | ${flagNote[k] ?? 'See the quality artefact.'} |`);
w();
w('> `goals_conceded` is the only field carrying **both** unit-defect flags');
w('> (`SCALE_INFLATION_X11` *and* `IMPOSSIBLE_SINGLE_MATCH_VALUES`). Treat it as');
w('> **unusable as stored** and re-derive from `opponent.goals ?? 0`.');
w();
w('> **`null` means zero for count fields** in the overwhelming majority of records');
w(`> (${n(qua.goalsConcededX11.nullMeansZeroConfirmedMatches)} confirmations), with ${qua.goalsConcededX11.nullContradictions} documented exceptions.`);
w('> Consequence: every published count `mean` is **conditional-on-nonzero** and biased');
w('> upward; it cannot be used as a base rate without recomputation.');
w('> **Exception:** for xG the nulls are *missing rows*, not zeros — do not `fillna(0)`');
w('> a frame that mixes xG and count columns.');
w();
w('> **`goals_conceded` is ×11** in 99.64% of admissible nonzero pairs, with a 0.36% ×1');
w('> minority feed segment. Never divide by 11 — derive it via the scale-invariant');
w('> mirror identity `opponent.goals ?? 0`.');
w();
w('> The three **gross xG aggregates** (`expected_goals`, `expected_goals_conceded`,');
w('> `expected_assists`) are `REJECT` as **redundant**, not corrupt:');
w('> `expected_goals ≡ expected_goals_nonpenalty + 0.7884 × penalties` and');
w('> `expected_assists ≡ openplay + setplay`. Consume the components.');
w();
w('---');
w();

/* ------------------------------------------------------------------ reproduce */
w('## 7. How To Reproduce');
w();
w('```bash');
w('# 1) Full warehouse audit (offline, read-only, no network).');
w('#    Regenerates every artefact listed below.');
w('node scripts/research/dribble360/elite-warehouse-audit.mjs');
w();
w('# 2) xG decomposition / redundancy probe (offline, read-only).');
w('node scripts/research/dribble360/d360_xg_decomp_probe.mjs \\');
w('     data/research/dribble360/harvest/team_matches_2023_2024.jsonl 20000');
w();
w('# 3) Re-render this report from the artefacts.');
w('node scripts/research/dribble360/emit-coverage-report.mjs');
w('```');
w();
w('Artefacts consumed (all under the gitignored `data/research/dribble360/` tree):');
w();
w('| Artefact | Purpose |');
w('|---|---|');
w('| `coverage/DRIBBLE360_FEATURE_COVERAGE.json` | Corpus summary, bridge, league×season matrix, per-feature coverage |');
w('| `quality/DRIBBLE360_FEATURE_QUALITY.json` | ×11 proof + decomposition, missingness, alias audit, all 303 features with class |');
w('| `canonical/DRIBBLE_MATCH_BRIDGE.json` | Per-match bridge + `UNBRIDGED` retention |');
w('| `canonical/DRIBBLE_TEAM_MAPPING.json` | Team identity bridge |');
w('| `manifests/WAREHOUSE_MANIFEST.json` | Corpus accounting + SHAs |');
w();
w('---');
w();

/* ---------------------------------------------------------------- governance */
w('## 8. Governance Pointers');
w();
w('- **Provider role.** Dribble360 is a **research/historical** provider only. It is');
w('  **not** a production odds authority: `OddsPAPI` remains the sole production odds');
w('  authority and `API-Football` the fixture/statistics authority.');
w('- **Retention/derivative rights are UNVERIFIED and BLOCKING.** Nothing in this');
w('  corpus may inform a shipped model until the licensing review clears.');
w('- **No future leakage.** Every `PRE_MATCH_SAFE_AS_LAG` field must be consumed as');
w('  `shift(1)` within team. See §5.1.');
w('- **No extraordinary result without audit.** Any ROI > 10%, Brier improvement');
w('  > 10%, or unusual performance jump derived from this corpus triggers a mandatory');
w('  leakage / target-definition / split / sample-size / methodology audit.');
w();
w('---');
w();
w('*Generated end of report.*');

/* --------------------------------------------------------------------- write */
const outAbs = path.resolve(ROOT, OUT);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
fs.writeFileSync(outAbs, L.join('\n') + '\n', 'utf8');
console.log(`Wrote ${OUT}`);
console.log(`  ${L.length} lines, ${(fs.statSync(outAbs).size / 1024).toFixed(1)} KB`);
console.log(`  ENG-PL cells: ${cells.length} | UNBRIDGED cells: ${cov.coverageMatrix.length - cells.length}`);
console.log(`  zero-coverage fields: ${zero.length} | total fields: ${cs.fields}`);
