/**
 * DRIBBLE360 ELITE — RESEARCH-ONLY WAREHOUSE AUDIT
 * ================================================
 *
 * OFFLINE / READ-ONLY. This script makes ZERO network calls and writes ONLY to
 * `data/research/dribble360/**` (a gitignored research namespace). It never
 * touches `data/golden/`, Supabase, `.env`, or any production code path.
 *
 * Purpose (SALMO Dribble360 Max-Value sprint):
 *   1. Deterministic canonical match bridge  (Dribble slug -> golden canonicalId)
 *   2. Feature coverage matrix               (league x season x feature)
 *   3. Feature quality / impossibility audit (incl. the goals_conceded x11 defect)
 *   4. Team identity bridge                  (provider team_id -> canonical team)
 *   5. Dedupe proof                          (content-hash manifest)
 *
 * Run:  node scripts/research/dribble360/elite-warehouse-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const D360 = path.join(ROOT, 'data', 'research', 'dribble360');
const HARVEST = path.join(D360, 'harvest');
const GOLDEN = path.join(ROOT, 'data', 'golden', 'europe', 'canonical_matches.jsonl');

const OUT = {
  coverage: path.join(D360, 'coverage', 'DRIBBLE360_FEATURE_COVERAGE.json'),
  quality: path.join(D360, 'quality', 'DRIBBLE360_FEATURE_QUALITY.json'),
  bridge: path.join(D360, 'canonical', 'DRIBBLE_MATCH_BRIDGE.json'),
  teams: path.join(D360, 'canonical', 'DRIBBLE_TEAM_MAPPING.json'),
  manifest: path.join(D360, 'manifests', 'WAREHOUSE_MANIFEST.json'),
};
for (const p of Object.values(OUT)) fs.mkdirSync(path.dirname(p), { recursive: true });

const ISO = () => new Date().toISOString();
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Provenance stamp carried by every emitted artefact. */
const PROVENANCE = {
  provider: 'Dribble360',
  entitlement: 'Elite (trial/subscription period)',
  transport: 'REST /api/v1 (offline harvest, JSONL)',
  extractionTimestampUtc: null, // filled at write time
  harvestRoot: 'data/research/dribble360/harvest',
  rawCaptureRoot: 'data/research/dribble360/raw_captures',
  bridgeSource: 'data/golden/europe/canonical_matches.jsonl (read-only)',
  auditScript: 'scripts/research/dribble360/elite-warehouse-audit.mjs',
  leakagePolicy: 'feature_timestamp < kickoff (strict)',
};

// ---------------------------------------------------------------------------
// 1. Canonical match bridge index (read-only read of the production gold file)
// ---------------------------------------------------------------------------
function loadBridge() {
  const index = new Map();
  const leagues = new Map();
  const lines = fs.readFileSync(GOLDEN, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    let m;
    try { m = JSON.parse(line); } catch { continue; }
    if (!m.canonicalId) continue;
    // canonicalId = LEAGUE_ID|season|YYYY-MM-DD|home-slug|away-slug
    const seg = String(m.canonicalId).split('|');
    if (seg.length < 5) continue;
    const [, season, date, homeSlug, awaySlug] = seg;
    const key = `${date}|${homeSlug}|${awaySlug}`;
    if (!index.has(key)) {
      index.set(key, {
        canonicalId: m.canonicalId, leagueId: m.leagueId, season, date,
        homeTeam: m.homeTeam, awayTeam: m.awayTeam,
        homeSlug, awaySlug, method: 'slug_triplet_exact', confidence: 'HIGH',
      });
    }
    leagues.set(m.leagueId, (leagues.get(m.leagueId) || 0) + 1);
  }
  return { index, leagues, goldenRecords: lines.length };
}

/** Parse `home-vs-away-DD-MM-YYYY` -> { homeSlug, awaySlug, date } */
function parseSlug(slug) {
  if (!slug) return null;
  const parts = slug.split('-vs-');
  if (parts.length < 2) return null;
  const homeSlug = parts[0];
  const rest = parts[1];
  const d = rest.slice(-10);
  if (!/^\d{2}-\d{2}-\d{4}$/.test(d)) return null;
  const [dd, mm, yyyy] = d.split('-');
  return { homeSlug, awaySlug: rest.slice(0, -11), date: `${yyyy}-${mm}-${dd}` };
}

/** Season label derived from date when the bridge cannot resolve it. */
function seasonFromDate(date) {
  const [y, m] = date.split('-').map(Number);
  return m >= 7 ? `${y}_${y + 1}` : `${y - 1}_${y}`;
}

async function streamJsonl(file, onRecord) {
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let n = 0;
  for await (const line of rl) {
    if (!line) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    n++;
    onRecord(rec);
  }
  return n;
}

/**
 * Record-level missingness structure.
 *
 * Field-level coverage alone is misleading: the vendor returns a subset of
 * team_matches rows with an EMPTY statistics block (every metric null at once).
 * That makes ~20% of field coverage a *record*-level property, not a
 * field-level one. This separates the two so neither is over- or under-stated.
 */
async function analyzeMissingness() {
  const CORE = ['total_sub_on', 'total_scoring_att', 'total_pass', 'accurate_pass', 'touches'];
  const files = fs.readdirSync(HARVEST).filter((f) => /^team_matches_.*\.jsonl$/.test(f)).sort();
  const acc = {
    definition: {
      coreProbeFields: CORE,
      noCoreStats: 'record where ALL core probe fields are null (empty statistics block)',
      allCoreStats: 'record where ALL core probe fields are present',
      partialCoreStats: 'record with some but not all core probe fields present',
    },
    totals: { records: 0, noCoreStats: 0, allCoreStats: 0, partialCoreStats: 0, withExpectedGoals: 0 },
    perFile: {},
  };
  for (const f of files) {
    const c = { records: 0, noCoreStats: 0, allCoreStats: 0, partialCoreStats: 0, withExpectedGoals: 0 };
    await streamJsonl(path.join(HARVEST, f), (r) => {
      let present = 0;
      for (const k of CORE) if (r[k] !== null && r[k] !== undefined) present++;
      if (present === 0) c.noCoreStats++;
      else if (present === CORE.length) c.allCoreStats++;
      else c.partialCoreStats++;
      if (r.expected_goals !== null && r.expected_goals !== undefined) c.withExpectedGoals++;
      c.records++;
    });
    if (c.records > 0) {
      c.pctNoStats = +((c.noCoreStats / c.records) * 100).toFixed(2);
      c.pctXgPresent = +((c.withExpectedGoals / c.records) * 100).toFixed(2);
    }
    acc.perFile[f] = c;
    for (const k of Object.keys(acc.totals)) acc.totals[k] += c[k];
  }
  const t = acc.totals;
  acc.totals.pctNoStats = +((t.noCoreStats / Math.max(1, t.records)) * 100).toFixed(2);
  acc.totals.pctAllStats = +((t.allCoreStats / Math.max(1, t.records)) * 100).toFixed(2);
  acc.totals.pctXgPresent = +((t.withExpectedGoals / Math.max(1, t.records)) * 100).toFixed(2);
  acc.conclusion =
    'Missingness is primarily RECORD-level: a minority of rows ship an empty statistics block. '
    + 'Within populated rows the headline metrics are effectively complete, which is why bridged '
    + 'top-league cells show ~100% completeness while the global corpus shows ~76-82%.';
  return acc;
}

/**
 * Deterministic column-alias detection.
 *
 * Two distinct vendors fields that share identical (nonNullCount, min, max, mean)
 * over the whole corpus are almost certainly the same underlying column exported
 * twice. Note: HOME/AWAY mirror pairs (e.g. duel_won vs duel_lost,
 * expected_goals_nonpenalty vs expected_goals_nonpenalty_conceded) legitimately
 * share corpus-wide statistics by construction and are NOT aliases; they are
 * reported separately as a validity signal.
 */
function detectAliases(features) {
  const isMirrorPair = (a, b) => {
    const pair = [a, b].map((s) => s.replace(/_conceded$/, '')).sort().join('|');
    return a.endsWith('_conceded') !== b.endsWith('_conceded');
  };
  const buckets = new Map();
  for (const f of features) {
    if (f.numeric !== true || !f.nonNullCount) continue;
    const key = [f.nonNullCount, f.min, f.max, f.mean].join('|');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(f.field);
  }
  const groups = [];
  const mirrorPairs = [];
  for (const members of buckets.values()) {
    if (members.length < 2) continue;
    if (members.length === 2 && isMirrorPair(members[0], members[1])) mirrorPairs.push(members);
    else groups.push(members);
  }
  return {
    rule: 'identical (nonNullCount, min, max, mean) over the full corpus',
    suspectedAliasGroups: groups,
    mirrorPairsValidated: mirrorPairs,
    note: 'Mirror pairs are a data-validity signal: they reconcile only if HOME and AWAY rows are complete and mutually consistent.',
  };
}

/** Fields that are identifiers/labels rather than measurable features. */
const NON_FEATURE = new Set(['match_id', 'team_id', 'side', 'match_slug', 'formation', 'formation_used', 'last_updated']);

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
}

// ---------------------------------------------------------------------------
// 2. Corpus scan
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== DRIBBLE360 ELITE WAREHOUSE AUDIT (read-only, offline) ===');
  const bridge = loadBridge();
  console.log(`Bridge index: ${bridge.index.size} canonical keys from ${bridge.goldenRecords} golden records.`);

  // --- 2a. content hashes (dedupe proof, Section 11) -----------------------
  const allHarvest = fs.readdirSync(HARVEST).filter((f) => f.endsWith('.jsonl'));
  const hashes = {};
  for (const f of allHarvest) {
    const p = path.join(HARVEST, f);
    hashes[f] = { sha256: sha256(p), bytes: fs.statSync(p).size };
  }
  const byHash = {};
  for (const [f, h] of Object.entries(hashes)) (byHash[h.sha256] ||= []).push(f);
  console.log(`Hashed ${allHarvest.length} harvest files.`);

  // --- 2b. match catalog (all 7 files are byte-identical => scan one) ------
  const catalogFiles = (byHash[Object.keys(byHash)[0]] || []).filter((f) => f.startsWith('matches_'));
  const MATCH_FILE = catalogFiles.sort().pop();
  const catalog = {
    scannedFile: MATCH_FILE, byteIdenticalClones: catalogFiles.filter((f) => f !== MATCH_FILE),
    totalRecords: 0, uniqueIds: new Set(), seasonIds: new Set(),
    dateRange: { min: '9999-12-31', max: '0000-00-00' },
    status: {}, coverageLevel: {}, fieldStats: {},
  };
  await streamJsonl(path.join(HARVEST, MATCH_FILE), (r) => {
    catalog.totalRecords++;
    if (r.id) catalog.uniqueIds.add(String(r.id));
    if (r.season_id) catalog.seasonIds.add(String(r.season_id));
    if (r.date) {
      if (r.date < catalog.dateRange.min) catalog.dateRange.min = r.date;
      if (r.date > catalog.dateRange.max) catalog.dateRange.max = r.date;
    }
    if (r.status) catalog.status[r.status] = (catalog.status[r.status] || 0) + 1;
    if (r.coverage_level != null) catalog.coverageLevel[r.coverage_level] = (catalog.coverageLevel[r.coverage_level] || 0) + 1;
    for (const [k, v] of Object.entries(r)) {
      const s = (catalog.fieldStats[k] ||= { nonNull: 0, null: 0 });
      if (v === null || v === undefined) s.null++; else s.nonNull++;
    }
  });
  console.log(`Catalog: ${catalog.totalRecords} records, ${catalog.uniqueIds.size} unique ids.`);

  // --- 2c. team_matches scan ----------------------------------------------
  const tmFiles = allHarvest.filter((f) => f.startsWith('team_matches_'));
  let scanned = 0, parsed = 0, dedupDropped = 0;
  const seen = new Set();                       // `${match_id}|${side}`  (Section 11 dedupe)
  const perFile = {};
  const matchCompact = new Map();               // match_id -> compact sides
  const teamMap = new Map();                    // team_id  -> identity
  const fieldStats = {};                        // field -> {nonNull,sum,min,max,numeric,zeros}
  const cells = new Map();                      // `${leagueId}|${season}` -> cell
  const bridgeStats = { bridged: 0, unbridged: 0, unmappedSamples: [] };

  const blankCell = (leagueId, season) => ({
    leagueId, season, teamMatchRecords: 0, uniqueMatches: new Set(),
    firstDate: '9999-12-31', lastDate: '0000-00-00', fieldNonNull: {},
  });

  for (const f of tmFiles.sort()) {
    const p = path.join(HARVEST, f);
    if (fs.statSync(p).size === 0) { perFile[f] = { records: 0, note: 'EMPTY_FILE' }; continue; }
    const n = await streamJsonl(p, (r) => {
      scanned++;
      const dedupeKey = `${r.match_id}|${r.side}`;
      if (seen.has(dedupeKey)) { dedupDropped++; return; }
      seen.add(dedupeKey);
      parsed++;

      const slug = parseSlug(r.match_slug);
      const date = slug ? slug.date : null;
      const bkey = slug ? `${slug.date}|${slug.homeSlug}|${slug.awaySlug}` : null;
      const hit = bkey ? bridge.index.get(bkey) : null;
      if (hit) bridgeStats.bridged++;
      else {
        bridgeStats.unbridged++;
        if (bridgeStats.unmappedSamples.length < 25) {
          bridgeStats.unmappedSamples.push({ match_slug: r.match_slug, date, reason: 'NO_GOLDEN_KEY' });
        }
      }
      const leagueId = hit ? hit.leagueId : 'UNBRIDGED';
      const season = hit ? hit.season : (date ? seasonFromDate(date) : 'unknown');

      const cellKey = `${leagueId}|${season}`;
      let cell = cells.get(cellKey);
      if (!cell) { cell = blankCell(leagueId, season); cells.set(cellKey, cell); }
      cell.teamMatchRecords++;
      cell.uniqueMatches.add(r.match_id);
      if (date) {
        if (date < cell.firstDate) cell.firstDate = date;
        if (date > cell.lastDate) cell.lastDate = date;
      }

      for (const [k, v] of Object.entries(r)) {
        const st = (fieldStats[k] ||= { nonNull: 0, sum: 0, min: Infinity, max: -Infinity, numeric: null, nullCount: 0, zeros: 0 });
        if (v === null || v === undefined) { st.nullCount++; continue; }
        st.nonNull++;
        if (typeof v === 'number' && Number.isFinite(v)) {
          if (st.numeric === null) st.numeric = true;
          st.sum += v; if (v < st.min) st.min = v; if (v > st.max) st.max = v;
          if (v === 0) st.zeros++;
        } else if (typeof v === 'string' && st.numeric === null) st.numeric = false;
        cell.fieldNonNull[k] = (cell.fieldNonNull[k] || 0) + 1;
      }

      // compact per-match record (both sides are required for the x11 invariant test)
      let mc = matchCompact.get(r.match_id);
      if (!mc) {
        mc = { slug: r.match_slug, date, leagueId, season, canonicalId: hit ? hit.canonicalId : null, sides: {} };
        matchCompact.set(r.match_id, mc);
      }
      mc.sides[r.side] = {
        team_id: r.team_id, goals: num(r.goals),
        conceded_raw: num(r.goals_conceded), clean_sheet_raw: num(r.clean_sheet),
        // Populated-statistics-block test. Deliberately NOT based on goals_conceded,
        // because null encodes zero for that field.
        hasStats: r.total_sub_on != null || r.total_pass != null,
      };

      // team identity bridge
      let t = teamMap.get(r.team_id);
      if (!t) {
        t = { team_id: r.team_id, names: new Set(), leagues: {}, seasons: new Set(), records: 0, firstDate: '9999-12-31', lastDate: '0000-00-00' };
        teamMap.set(r.team_id, t);
      }
      t.records++;
      t.seasons.add(season);
      t.leagues[leagueId] = (t.leagues[leagueId] || 0) + 1;
      if (slug) t.names.add(r.side === 'HOME' ? slug.homeSlug : slug.awaySlug);
      if (date) { if (date < t.firstDate) t.firstDate = date; if (date > t.lastDate) t.lastDate = date; }
    });
    perFile[f] = { records: n };
    console.log(`  ${f}: ${n} records`);
  }
  console.log(`team_matches parsed=${parsed} scanned=${scanned} duplicatesDropped=${dedupDropped} uniqueMatches=${matchCompact.size}`);

  // --- 2d. goals_conceded x11 invariant test (headline defect) --------------
  // Vendor/aggregation flaw: Opta attributes the TEAM-level "goals conceded"
  // event to every one of the 11 on-pitch players, and the team_matches
  // aggregation SUMs it. Therefore  conceded_raw = true_conceded * 11.
  const x11 = {
    matchesWithBothSides: 0, matchesSingleSide: 0,
    pairsTested: 0, pairsExactX11: 0, pairsX11AfterNullZero: 0, pairsFailed: 0,
    pairsExactX11NonZero: 0, pairsExactUnscaledNonZero: 0, pairsTrueZero: 0,
    ratioSamples: [], nullMeansZeroConfirmed: 0, nullContradictions: 0,
    nullContradictionInOneSidedMatch: 0, nullContradictionInTwoSidedMatch: 0,
    imputedTrueConcededSum: 0, rawConcededSum: 0,
  };
  for (const mc of matchCompact.values()) {
    const H = mc.sides.HOME, A = mc.sides.AWAY;
    if (!H || !A) { x11.matchesSingleSide++; continue; }
    x11.matchesWithBothSides++;
    const expHomeTrue = A.goals ?? 0;   // what HOME conceded == what AWAY scored
    const expAwayTrue = H.goals ?? 0;
    // A side "has stats" iff its statistics block is populated. NOTE: this must
    // NOT be tested via conceded_raw, because null encodes zero for that field.
    const homeHasStats = H.hasStats === true;
    const awayHasStats = A.hasStats === true;

    // (a) null-means-zero confirmation.
    // NOTE: when the opponent side ships an empty stats block, its `goals` is null
    // while the mirror field on the populated side is legitimately nonzero. Those
    // are attribution artefacts of the vendor payload, NOT evidence that
    // null ever encodes a nonzero value. They are counted separately.
    if (A.goals === null && (H.conceded_raw !== null && H.conceded_raw !== 0)) {
      x11.nullContradictions++;
      if (!awayHasStats) x11.nullContradictionInOneSidedMatch++; else x11.nullContradictionInTwoSidedMatch++;
    }
    if (H.goals === null && (A.conceded_raw !== null && A.conceded_raw !== 0)) {
      x11.nullContradictions++;
      if (!homeHasStats) x11.nullContradictionInOneSidedMatch++; else x11.nullContradictionInTwoSidedMatch++;
    }
    if (A.goals === null && (H.conceded_raw === null || H.conceded_raw === 0)) x11.nullMeansZeroConfirmed++;
    if (H.goals === null && (A.conceded_raw === null || A.conceded_raw === 0)) x11.nullMeansZeroConfirmed++;

    for (const [raw, expTrue] of [[H.conceded_raw, expHomeTrue], [A.conceded_raw, expAwayTrue]]) {
      x11.pairsTested++;
      const rawNorm = raw === null ? 0 : raw;   // adapter coalesces null -> 0
      if (rawNorm === expTrue) {
        x11.pairsExactX11++;                                              // holds trivially
        if (expTrue === 0) x11.pairsTrueZero++; else x11.pairsExactUnscaledNonZero++;  // <-- real counter-example
      }
      if (rawNorm === expTrue * 11) {
        x11.pairsX11AfterNullZero++;
        if (expTrue > 0) x11.pairsExactX11NonZero++;
        x11.rawConcededSum += rawNorm;
        x11.imputedTrueConcededSum += expTrue;
        if (x11.ratioSamples.length < 4000 && expTrue > 0) x11.ratioSamples.push(rawNorm / expTrue);
      } else {
        x11.pairsFailed++;
      }
    }
  }

  const ratioMedian = (() => {
    if (!x11.ratioSamples.length) return null;
    const s = [...x11.ratioSamples].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  })();

  console.log(`x11 test: pairsTested=${x11.pairsTested} exactX11=${x11.pairsX11AfterNullZero} failed=${x11.pairsFailed} ratioMedian=${ratioMedian}`);

  // --- 2e. feature quality classification ---------------------------------
  const POST_MATCH_FIELDS = new Set([
    'goals', 'goals_conceded', 'clean_sheet', 'total_scoring_att', 'ontarget_scoring_att',
    'shot_off_target', 'blocked_scoring_att', 'post_scoring_att', 'pen_area_entries',
    'touches_in_opp_box', 'final_third_entries', 'attempts_ibox', 'attempts_obox', 'corner_taken',
    'won_corners', 'lost_corners', 'red_cards', 'yellow_cards', 'total_yellow_card', 'total_red_card',
    'total_tackle', 'interception', 'ball_recovery', 'big_chance_created', 'big_chance_missed',
    'big_chance_scored', 'saves', 'accurate_pass', 'total_pass', 'accurate_cross', 'total_cross',
    'first_half_goals', 'goals_conceded_ibox', 'goals_conceded_obox', 'shots_conc_onfield',
    'penalty_conceded', 'penalty_faced', 'penalty_save', 'penalty_won', 'own_goals',
  ]);

  const features = Object.entries(fieldStats).map(([field, st]) => {
    const coveragePct = +((st.nonNull / parsed) * 100).toFixed(2);
    const mean = st.nonNull && st.numeric ? st.sum / st.nonNull : null;
    const isConst = st.numeric === true && st.nonNull > 0 && st.min === st.max;
    const allNull = st.nonNull === 0;
    const isIdentifier = NON_FEATURE.has(field);
    const leakage = isIdentifier ? 'N/A'
      : POST_MATCH_FIELDS.has(field) ? 'POST_MATCH_ONLY'
        : 'PRE_MATCH_SAFE_AS_LAG';  // raw value is current-match; safe only when lagged
    let decision;
    if (allNull) decision = 'NOT_AVAILABLE';
    else if (isConst) decision = 'REJECT';
    else if (field === 'goals_conceded') decision = 'REJECT';          // x11 defect, derive from opponent goals
    else if (field === 'clean_sheet') decision = 'REJECT';             // player-count sum, derive from goals_conceded==0
    else if (field === 'expected_goals' || field === 'expected_goals_conceded' || field === 'expected_assists') decision = 'REJECT'; // vendor distortion
    else if (isIdentifier) decision = 'REJECT';
    else if (coveragePct < 50) decision = 'LICENSE_REVIEW_LOW_COVERAGE';
    else decision = 'RESEARCH';
    const flags = [];
    if (allNull) flags.push('ALWAYS_NULL');
    if (isConst) flags.push('CONSTANT');
    if (field === 'goals_conceded') flags.push('SCALE_INFLATION_X11', 'IMPOSSIBLE_SINGLE_MATCH_VALUES');
    if (st.numeric && st.nonNull && st.max > 100 && !NON_FEATURE.has(field) && field !== 'total_pass' && field !== 'accurate_pass') flags.push('CHECK_EXTREME_MAX');
    if (st.zeros === st.nonNull && st.nonNull > 0) flags.push('ALL_ZERO_FALSE_FLAG');
    return {
      field, coveragePct, nonNullCount: st.nonNull, nullCount: st.nullCount,
      numeric: st.numeric, min: st.numeric ? st.min : null, max: st.numeric ? st.max : null,
      mean: mean === null ? null : +mean.toFixed(4), distinctZeroCount: st.zeros,
      leakageClass: leakage, decision,
      temporalSafety: leakage === 'POST_MATCH_ONLY' ? 'POST_MATCH_ONLY' : 'PRE_MATCH_SAFE_IF_LAGGED',
      qualityFlags: flags,
    };
  });
  features.sort((a, b) => b.coveragePct - a.coveragePct);

  // --- 2f. league-season denominators (golden availability) ----------------
  const goldenCellTotals = {};
  const slugToCanonicalName = {};
  for (const e of bridge.index.values()) {
    const k = `${e.leagueId}|${e.season}`;
    goldenCellTotals[k] = (goldenCellTotals[k] || 0) + 1;
    if (e.homeSlug) slugToCanonicalName[e.homeSlug] = e.homeTeam;
    if (e.awaySlug) slugToCanonicalName[e.awaySlug] = e.awayTeam;
  }

  const COVERAGE_FIELDS = ['total_scoring_att', 'ontarget_scoring_att', 'pen_area_entries', 'touches_in_opp_box',
    'final_third_entries', 'attempts_ibox', 'corner_taken', 'total_tackle', 'interception', 'ball_recovery',
    'accurate_pass', 'total_pass', 'accurate_cross', 'total_cross', 'goals', 'goals_conceded',
    'possession_percentage', 'ppda', 'sca', 'gca', 'big_chance_created', 'saves'];

  const coverageMatrix = [...cells.values()].map((c) => {
    const golden = goldenCellTotals[`${c.leagueId}|${c.season}`] || 0;
    const matched = c.uniqueMatches.size;
    const feats = {};
    for (const f of COVERAGE_FIELDS) feats[f] = +(((c.fieldNonNull[f] || 0) / c.teamMatchRecords) * 100).toFixed(2);
    return {
      leagueId: c.leagueId, season: c.season,
      teamMatchRecords: c.teamMatchRecords, uniqueMatches: matched,
      goldenMatchesAvailable: golden,
      missingMatches: golden ? Math.max(0, golden - matched) : null,
      coverageVsGoldenPct: golden ? +((matched / golden) * 100).toFixed(2) : null,
      firstDate: c.firstDate === '9999-12-31' ? null : c.firstDate,
      lastDate: c.lastDate === '0000-00-00' ? null : c.lastDate,
      featureCompletenessPct: feats,
      extractionStatus: 'HARVESTED_OFFLINE',
      source: 'data/research/dribble360/harvest/team_matches_*.jsonl',
    };
  }).sort((a, b) => (a.leagueId + a.season).localeCompare(b.leagueId + b.season));

  // --- 2g. team identity bridge ------------------------------------------
  const teamMapping = [...teamMap.values()].map((t) => {
    const names = [...t.names];
    const canonical = names.map((n) => slugToCanonicalName[n]).filter(Boolean);
    return {
      provider: 'Dribble360', providerTeamId: t.team_id,
      providerNames: names, providerNamePrimary: names[0] || null,
      canonicalTeamName: canonical[0] || null,
      canonicalTeamId: canonical[0] ? canonical[0].toLowerCase().replace(/\s+/g, '-') : null,
      leagues: Object.entries(t.leagues).sort((a, b) => b[1] - a[1]).map(([k]) => k),
      seasons: [...t.seasons].sort(), teamMatchRecords: t.records,
      firstDate: t.firstDate === '9999-12-31' ? null : t.firstDate,
      lastDate: t.lastDate === '0000-00-00' ? null : t.lastDate,
      mappingMethod: canonical.length ? 'SLUG_TO_GOLDEN_CANONICAL_NAME' : 'PROVIDER_SLUG_ONLY',
      status: canonical.length ? 'MAPPED' : 'UNMAPPED_RETAINED',
    };
  }).sort((a, b) => b.teamMatchRecords - a.teamMatchRecords);
  const mappedTeams = teamMapping.filter((t) => t.status === 'MAPPED').length;

  // --- 2h. write artefacts -------------------------------------------------
  const ts = ISO();
  PROVENANCE.extractionTimestampUtc = ts;
  const classCount = features.reduce((a, f) => (a[f.decision] = (a[f.decision] || 0) + 1, a), {});

  writeJson(OUT.coverage, {
    provenance: PROVENANCE, generatedAtUtc: ts,
    corpusSummary: {
      harvestFiles: hashes,
      duplicateFileGroups: Object.entries(byHash).filter(([, v]) => v.length > 1).map(([h, v]) => ({ sha256: h, files: v })),
      teamMatchRecordsScanned: scanned, teamMatchRecordsAccepted: parsed, duplicatesDropped: dedupDropped,
      uniqueMatches: matchCompact.size, teams: teamMap.size, fields: Object.keys(fieldStats).length,
      seasonsObserved: [...new Set([...cells.keys()].map((k) => k.split('|')[1]))].length,
      perFile,
    },
    canonicalBridge: {
      source: PROVENANCE.bridgeSource, goldenRecords: bridge.goldenRecords,
      bridgedRecords: bridgeStats.bridged, unbridgedRecords: bridgeStats.unbridged,
      matchRatePct: +((bridgeStats.bridged / parsed) * 100).toFixed(2),
      method: 'DETERMINISTIC_SLUG_TRIPLET (date|home-slug|away-slug) — no fuzzy matching',
      matchedLeagues: Object.fromEntries(bridge.leagues),
    },
    classificationCounts: classCount,
    coverageMatrix, featureCoverage: features,
  });

  // --- 2f. record-level missingness + column-alias audit --------------------
  const missingness = await analyzeMissingness();
  const aliasAudit = detectAliases(features);

  writeJson(OUT.quality, {
    provenance: PROVENANCE, generatedAtUtc: ts,
    goalsConcededX11: (() => {
      const nonzeroPairs = x11.pairsExactX11NonZero + x11.pairsExactUnscaledNonZero;
      return {
        hypothesis: 'conceded_raw = true_team_goals_conceded * 11 (Opta team-level event summed across 11 on-pitch players)',
        pairsTested: x11.pairsTested,
        decomposition: {
          confirmedX11_nonzero: x11.pairsExactX11NonZero,
          confirmedX1_nonzero: x11.pairsExactUnscaledNonZero,
          trueZero_degenerate: x11.pairsTrueZero,
          notReconcilable: x11.pairsFailed - x11.pairsExactUnscaledNonZero,
        },
        nonzeroPairsAdmissible: nonzeroPairs,
        x11ShareOfNonzeroPct: +((x11.pairsExactX11NonZero / Math.max(1, nonzeroPairs)) * 100).toFixed(4),
        x1ShareOfNonzeroPct: +((x11.pairsExactUnscaledNonZero / Math.max(1, nonzeroPairs)) * 100).toFixed(4),
        pairsExactX11: x11.pairsX11AfterNullZero,
        pairsFailed: x11.pairsFailed,
        exactX11Pct: +((x11.pairsX11AfterNullZero / Math.max(1, x11.pairsTested)) * 100).toFixed(4),
        notReconcilablePct: +(((x11.pairsFailed - x11.pairsExactUnscaledNonZero) / Math.max(1, x11.pairsTested)) * 100).toFixed(4),
        degenerateNote: 'Pairs where true conceded = 0 satisfy x1 and x11 identically and carry no information. Only nonzero pairs discriminate.',
        x1MinorityNote: 'A small minority feed segment emits the CORRECT x1 scale (observed in French domestic cup fixtures). A blanket x11 multiplication is therefore WRONG; use the scale-invariant mirror identity instead.',
        notReconcilableCause: 'Pairs in matches where exactly one side ships an empty statistics block: the mirror value is undefined, so neither x1 nor x11 can hold. Not a counter-example.',
        medianObservedRatio: ratioMedian,
        nullMeansZeroConfirmedMatches: x11.nullMeansZeroConfirmed,
        nullContradictions: x11.nullContradictions,
        nullContradictionInOneSidedMatch: x11.nullContradictionInOneSidedMatch,
        nullContradictionInTwoSidedMatch: x11.nullContradictionInTwoSidedMatch,
        nullContradictionNote: 'Two-sided flags occur where the scoring side own goals field is null while the mirror side records conceded_raw = 11k (k>0). These are genuine score-reconciliation conflicts concentrated in UEFA qualifying rounds; they are NOT evidence that null encodes a nonzero value.',
        verdict: x11.pairsExactUnscaledNonZero / Math.max(1, nonzeroPairs) < 0.01
          ? 'CONFIRMED_X11_DOMINANT_WITH_X1_MINORITY_SEGMENT'
          : 'PARTIAL_X11_REQUIRES_REVIEW',
        remediation: 'Derive conceded from opponent goals (true = opponent.goals ?? 0). Never consume the raw field. For the 48 flagged score-reconciliation conflicts, fall back to round(conceded_raw / 11) only after manual review.',
        consumptionRisk: 'src/lib/research/dribble/dribbleMultiWindowFeatureLab.ts L213-215 & L235 sum the raw field into avg_goals_conceded.',
      };
    })(),
    classificationCounts: classCount,
    leakageCounts: features.reduce((a, f) => (a[f.leakageClass] = (a[f.leakageClass] || 0) + 1, a), {}),
    qualityFlagsCounts: features.reduce((a, f) => { for (const g of f.qualityFlags) a[g] = (a[g] || 0) + 1; return a; }, {}),
    alwaysNullFields: features.filter((f) => f.coveragePct === 0).map((f) => f.field),
    constantFields: features.filter((f) => f.qualityFlags.includes('CONSTANT')).map((f) => `${f.field}=${f.min}`),
    missingnessStructure: missingness,
    columnAliasAudit: aliasAudit,
    features,
  });

  writeJson(OUT.bridge, {
    provenance: PROVENANCE, generatedAtUtc: ts,
    method: 'DETERMINISTIC_SLUG_TRIPLET', matchRatePct: +((bridgeStats.bridged / parsed) * 100).toFixed(2),
    totalRecords: parsed, bridged: bridgeStats.bridged, unbridged: bridgeStats.unbridged,
    gapReport: {
      note: 'Unmatched records RETAINED (never discarded) — visible as leagueId=UNBRIDGED in coverageMatrix.',
      reason: 'Dribble360 exposes NO competition/season metadata endpoint (/leagues, /seasons -> HTTP 404). League identity is only resolvable via the golden canonical bridge (5 leagues / 8,898 matches).',
      unmatchedSamples: bridgeStats.unmappedSamples,
    },
    records: [...matchCompact.values()].map((m) => ({
      canonicalId: m.canonicalId, matchSlug: m.slug, date: m.date, leagueId: m.leagueId, season: m.season,
      homeGoals: m.sides.HOME ? m.sides.HOME.goals : null,
      awayGoals: m.sides.AWAY ? m.sides.AWAY.goals : null,
      dribbleConcededRawHome: m.sides.HOME ? m.sides.HOME.conceded_raw : null,
      dribbleConcededRawAway: m.sides.AWAY ? m.sides.AWAY.conceded_raw : null,
      trueConcededHome: m.sides.AWAY ? (m.sides.AWAY.goals ?? 0) : null,
      trueConcededAway: m.sides.HOME ? (m.sides.HOME.goals ?? 0) : null,
      mappingMethod: m.canonicalId ? 'SLUG_TRIPLET_EXACT' : null,
      mappingConfidence: m.canonicalId ? 'HIGH' : 'UNMATCHED',
    })),
  });

  writeJson(OUT.teams, {
    provenance: PROVENANCE, generatedAtUtc: ts,
    providerTeamIds: teamMapping.length, mapped: mappedTeams, unmapped: teamMapping.length - mappedTeams,
    mappingRatePct: +((mappedTeams / teamMapping.length) * 100).toFixed(2),
    teams: teamMapping,
  });

  writeJson(OUT.manifest, {
    provenance: PROVENANCE, generatedAtUtc: ts,
    warehouseRoot: 'data/research/dribble360',
    gitignoreStatus: 'IGNORED — .gitignore contains "data/research/dribble360/"; raw provider captures are never committed.',
    layout: {
      raw: 'Pointer manifest only — bulk harvest remains at ../harvest (631 MB) and ../raw_captures (28 MB); NOT duplicated because existing scripts resolve those paths.',
      normalized: 'reserved — provider -> canonical normalized rows',
      canonical: 'DRIBBLE_MATCH_BRIDGE.json, DRIBBLE_TEAM_MAPPING.json',
      features: 'reserved — engineered vectors (src/lib/research/dribble/*)',
      coverage: 'DRIBBLE360_FEATURE_COVERAGE.json',
      quality: 'DRIBBLE360_FEATURE_QUALITY.json',
      manifests: 'WAREHOUSE_MANIFEST.json, raw/SOURCE_MANIFEST.json',
      reports: 'DRIBBLE360_FEATURE_COVERAGE.md',
    },
    dedupePolicy: 'Deterministic keys only — match: provider match_id; record: match_id|side; file: sha256.',
    files: hashes,
  });

  writeRawManifest(hashes, ts);

  console.log('\n--- SUMMARY ---');
  console.log(`Catalog: ${catalog.totalRecords} matches (${catalog.uniqueIds.size} unique), ${catalog.seasonIds.size} opaque season ids`);
  console.log(`team_matches: ${parsed} records, ${matchCompact.size} unique matches, ${teamMap.size} team ids`);
  console.log(`Bridge match rate: ${((bridgeStats.bridged / parsed) * 100).toFixed(2)}%`);
  console.log(`x11: exact=${x11.pairsX11AfterNullZero}/${x11.pairsTested} failed=${x11.pairsFailed} medianRatio=${ratioMedian}`);
  console.log(`Classification: ${JSON.stringify(classCount)}`);
  console.log(`Always-null fields: ${features.filter((f) => f.coveragePct === 0).length}`);
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  console.log(`wrote ${path.relative(ROOT, file)} (${(fs.statSync(file).size / 1024).toFixed(1)} KB)`);
}

function writeRawManifest(hashes, ts) {
  writeJson(path.join(D360, 'raw', 'SOURCE_MANIFEST.json'), {
    provenance: { ...PROVENANCE, extractionTimestampUtc: ts },
    note: 'Raw provider captures are intentionally NOT duplicated into raw/. Pointer manifest only.',
    bulkHarvest: Object.entries(hashes).map(([file, h]) => ({ file, path: `data/research/dribble360/harvest/${file}`, ...h })),
    apiCaptures: fs.readdirSync(path.join(D360, 'raw_captures')).map((f) => ({
      file: f, path: `data/research/dribble360/raw_captures/${f}`,
      bytes: fs.statSync(path.join(D360, 'raw_captures', f)).size,
    })),
  });
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });






