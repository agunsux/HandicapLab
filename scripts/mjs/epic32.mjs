import fs from "fs";
import path from "path";

const BASE = "src/pipelines";

const dirs = ["", "silver", "features", "golden", "validation", "walkforward", "baselines"];
dirs.forEach(d => {
  const p = path.join(BASE, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

function write(fn, content) {
  const fp = path.join(BASE, fn);
  // Strip any write_to_file artifacts
  const clean = content.replace(/<\/write_to_file>[\s\S]*$/, "").trim();
  fs.writeFileSync(fp, clean + "\n", "utf8");
  console.log("Written:", fp);
}

// types.ts
write("types.ts", `export interface UnderstatFixture {
  fixtureId: string; fixtureNaturalKey: string;
  competitionId: string; seasonId: string;
  homeTeamId: string; awayTeamId: string;
  homeGoals: { value: number; source: string; confidence: number; mergeReason: string };
  awayGoals: { value: number; source: string; confidence: number; mergeReason: string };
  homeXg: { value: number; source: string; confidence: number; mergeReason: string };
  awayXg: { value: number; source: string; confidence: number; mergeReason: string };
  datetime?: string;
}
export interface FootballDataRow {
  Date: string; HomeTeam: string; AwayTeam: string;
  FTHG: string; FTAG: string; FTR: string;
  B365H: string; B365D: string; B365A: string;
  "B365>2.5": string; "B365<2.5": string;
  B365CH?: string; B365CD?: string; B365CA?: string;
}
export type FixtureId = string; export type TeamId = string;
export type ConfidenceScore = number;
export interface SilverFixture {
  fixture_id: FixtureId; season: string; competition: string;
  date: string; datetime: string | null;
  home_team: TeamId; away_team: TeamId;
  home_team_name: string; away_team_name: string;
  home_goals: number | null; away_goals: number | null;
  result: "H" | "D" | "A" | null;
  home_xg: number | null; away_xg: number | null;
  home_xg_shot: number | null; away_xg_shot: number | null;
  odds_home: number | null; odds_draw: number | null; odds_away: number | null;
  odds_over25: number | null; odds_under25: number | null;
  odds_closing_home: number | null; odds_closing_draw: number | null;
  odds_closing_away: number | null; odds_closing_over25: number | null; odds_closing_under25: number | null;
  lineage: { understat_id?: string; understat_source: string; football_data_source: string; merged_at: string; pipeline_version: string; git_commit: string; };
  confidence: ConfidenceScore; merge_notes?: string[]; checksum: string;
}
export interface MergeAudit {
  season: string; competition: string;
  total_understat: number; total_football_data: number;
  merged: number; understat_only: number; football_data_only: number;
  score_mismatches: number; confidence_avg: number;
  confidence_distribution: Record<string, number>;
  duplicate_matches_detected: number; timestamp: string; pipeline_version: string;
}
export interface FixtureFeatures {
  fixture_id: FixtureId; season: string; competition: string;
  date: string; home_team: TeamId; away_team: TeamId;
  kickoff_timestamp: string; features: Record<string, number | null>;
  generated_at: string; pipeline_version: string; checksum: string;
}
export type MarketType = "moneyline" | "asian_handicap" | "over_under";
export type SplitLabel = "train" | "validation" | "test";
export interface GoldenDatasetRow {
  fixture_id: FixtureId; season: string; competition: string;
  date: string; kickoff_timestamp: string;
  home_team: TeamId; away_team: TeamId;
  home_team_name: string; away_team_name: string;
  market: MarketType; features: Record<string, number | null>;
  target: number | null; actual_result: string | null;
  odds_home: number | null; odds_draw: number | null; odds_away: number | null;
  odds_over25: number | null; odds_under25: number | null;
  split: SplitLabel; fold: number; season_label: string;
}
export type ValidationSeverity = "critical" | "error" | "warning" | "info";
export interface ValidationIssue {
  code: string; severity: ValidationSeverity; message: string;
  fixture_id?: FixtureId; details?: Record<string, unknown>;
}
export interface QualityReport {
  pipeline_run_id: string; generated_at: string;
  total_fixtures: number; total_features: number;
  missing_values: Record<string, number>;
  duplicate_fixtures: number; invalid_odds: number; negative_xg: number;
  team_consistency_issues: number; season_completeness: Record<string, number>;
  feature_distributions: Record<string, { min: number; max: number; mean: number; std: number; null_count: number }>;
  leakage_checks_passed: boolean; rolling_integrity_ok: boolean;
  market_integrity_ok: boolean; label_integrity_ok: boolean;
  issues: ValidationIssue[]; pipeline_version: string; checksum: string;
}
export type WindowStrategy = "expanding" | "rolling" | "season_by_season";
export interface WalkForwardFold {
  fold: number; train_start: string; train_end: string;
  test_start: string; test_end: string;
  train_count: number; test_count: number;
  train_seasons: string[]; test_seasons: string[];
}
export interface PipelineResult {
  success: boolean; phases_completed: string[];
  errors: string[]; warnings: string[]; artifacts: string[];
  duration_ms: number; checksums: Record<string, string>;
}`);

// utils.ts
write("utils.ts", `import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export function getPipelineVersion(): string {
  try { return JSON.parse(fs.readFileSync("package.json", "utf8")).version || "0.0.0"; }
  catch { return "0.0.0"; }
}
export function getGitCommit(): string {
  try { return fs.readFileSync(".git/HEAD", "utf8").trim(); }
  catch {
    try {
      const h = fs.readFileSync(".git/HEAD", "utf8").trim();
      if (h.startsWith("ref: ")) return fs.readFileSync(path.join(".git", h.slice(5).replace(/\\//g, path.sep)), "utf8").trim();
      return h;
    } catch { return "unknown"; }
  }
}
export function getBuildTimestamp(): string { return new Date().toISOString(); }
export function computeChecksum(d: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(d, Object.keys(d as object).sort()), "utf8").digest("hex");
}
export function computeFixtureId(c: string, s: string, h: string, a: string, d: string): string {
  return crypto.createHash("sha256").update(c + "|" + s + "|" + h.toUpperCase() + "|" + a.toUpperCase() + "|" + d, "utf8").digest("hex");
}
export function readJSON<T>(fp: string): T | null {
  try {
    if (!fs.existsSync(fp)) return null;
    let r = fs.readFileSync(fp, "utf8");
    if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
    return JSON.parse(r) as T;
  } catch { return null; }
}
export function writeJSON(fp: string, d: unknown): void {
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(d, null, 2) + "\\n", "utf8");
}
export function ensureDir(d: string): void {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
export function parseCSV<T>(text: string): T[] {
  const lines = text.split("\\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const h = lines[0].split(",").map(x => x.trim());
  const rows: T[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals: string[] = [];
    let cur = "", q = false;
    for (let j = 0; j < lines[i].length; j++) {
      const c = lines[i][j];
      if (c === '"') q = !q;
      else if (c === "," && !q) { vals.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    vals.push(cur.trim());
    const row: any = {};
    h.forEach((x, j) => { row[x] = (vals[j] || "").trim(); });
    rows.push(row);
  }
  return rows;
}
export function parseFootballDataDate(d: string): string {
  const p = d.split("/");
  if (p.length !== 3) return d;
  let y = p[2];
  if (y.length === 2) y = "20" + y;
  return y + "-" + p[1].padStart(2, "0") + "-" + p[0].padStart(2, "0");
}
export function normalizeTeamName(n: string): string {
  return n.toLowerCase().trim().replace(/\\s+/g, " ");
}
export function elapsedMs(s: [number, number]): number {
  const d = process.hrtime(s);
  return Math.round(d[0] * 1000 + d[1] / 1e6);
}
export const DEFAULT_COMPETITIONS = ["EPL"];
export const DEFAULT_SEASONS = [
  "2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020",
  "2020-2021", "2021-2022", "2022-2023", "2023-2024", "2024-2025", "2025-2026"
];`);

// merge-engine.ts
write("silver/merge-engine.ts", `import * as fs from "fs";
import * as path from "path";
import {
  computeChecksum, computeFixtureId, readJSON, writeJSON, parseCSV,
  parseFootballDataDate, normalizeTeamName, getPipelineVersion, getGitCommit,
  getBuildTimestamp, ensureDir, elapsedMs, DEFAULT_COMPETITIONS, DEFAULT_SEASONS
} from "../utils";
import type { UnderstatFixture, FootballDataRow, SilverFixture, MergeAudit } from "../types";
interface USI { [key: string]: { date: string; home: string; away: string; homeGoals: number | null; awayGoals: number | null; homeXg: number | null; awayXg: number | null; understatId: string; datetime: string | null; }; }
interface FDI { [key: string]: { date: string; home: string; away: string; homeGoals: number | null; awayGoals: number | null; result: "H" | "D" | "A" | null; odds_home: number | null; odds_draw: number | null; odds_away: number | null; odds_over25: number | null; odds_under25: number | null; odds_close_home: number | null; odds_close_draw: number | null; odds_close_away: number | null; odds_close_over25: number | null; odds_close_under25: number | null; }; }

function bldUSI(c: string, s: string, bp: string): USI {
  const idx: USI = {};
  const sp = path.join(bp, "understat", c, s, "matches.json");
  let f = readJSON<UnderstatFixture[]>(sp);
  if (!f) f = readJSON<UnderstatFixture[]>(path.join(bp, c, s + "_understat.json"));
  if (!f) return idx;
  for (const x of f) {
    let date: string | null = null;
    if (x.datetime) date = x.datetime.substring(0, 10);
    else if (x.fixtureNaturalKey) { const pts = x.fixtureNaturalKey.split("|"); if (pts.length >= 5) date = pts[4]; }
    const h = x.homeTeamId ? normalizeTeamName(x.homeTeamId) : "";
    const a = x.awayTeamId ? normalizeTeamName(x.awayTeamId) : "";
    if (!date || !h || !a) continue;
    idx[date + "|" + h + "|" + a] = { date, home: h, away: a, homeGoals: x.homeGoals?.value ?? null, awayGoals: x.awayGoals?.value ?? null, homeXg: x.homeXg?.value ?? null, awayXg: x.awayXg?.value ?? null, understatId: x.fixtureId || "", datetime: x.datetime || null };
  }
  return idx;
}
function bldFDI(rows: FootballDataRow[]): FDI {
  const idx: FDI = {};
  for (const r of rows) {
    if (!r.Date || !r.HomeTeam) continue;
    const date = parseFootballDataDate(r.Date);
    const h = normalizeTeamName(r.HomeTeam);
    const a = normalizeTeamName(r.AwayTeam);
    idx[date + "|" + h + "|" + a] = { date, home: h, away: a, homeGoals: r.FTHG === "" ? null : +r.FTHG, awayGoals: r.FTAG === "" ? null : +r.FTAG, result: (r.FTR as "H" | "D" | "A") || null, odds_home: r.B365H === "" ? null : +r.B365H, odds_draw: r.B365D === "" ? null : +r.B365D, odds_away: r.B365A === "" ? null : +r.B365A, odds_over25: r["B365>2.5"] === "" ? null : +r["B365>2.5"], odds_under25: r["B365<2.5"] === "" ? null : +r["B365<2.5"], odds_close_home: r.B365CH === "" ? null : +r.B365CH, odds_close_draw: r.B365CD === "" ? null : +r.B365CD, odds_close_away: r.B365CA === "" ? null : +r.B365CA, odds_close_over25: null, odds_close_under25: null };
  }
  return idx;
}
function mergeSeason(c: string, s: string, o: any): { fixtures: SilverFixture[]; audit: MergeAudit } {
  const bp = o.bronzeBasePath!;
  const usI = bldUSI(c, s, bp);
  const csvP = [path.join(bp, "football_data", c, s + ".csv"), path.join(bp, "football_data", s + ".csv")].find(f => fs.existsSync(f));
  let fdI: FDI = {};
  if (csvP) fdI = bldFDI(parseCSV<FootballDataRow>(fs.readFileSync(csvP, "utf8")));
  else console.warn("No CSV for", c, s);
  const fixtures: SilverFixture[] = []; const matched = new Set<string>();
  let merged = 0, usOnly = 0, fdOnly = 0, mism = 0, dup = 0;
  const confD: Record<string, number> = { "1.0": 0, "0.9": 0, "0.8": 0, "0.7": 0, "0.6": 0, "<0.6": 0 };
  const rc = (v: number) => { if (v >= 1) confD["1.0"]++; else if (v >= 0.9) confD["0.9"]++; else if (v >= 0.8) confD["0.8"]++; else if (v >= 0.7) confD["0.7"]++; else if (v >= 0.6) confD["0.6"]++; else confD["<0.6"]++; };
  const seen = new Set<string>();
  for (const [k, us] of Object.entries(usI)) {
    const fd = fdI[k];
    if (fd) {
      matched.add(k); merged++;
      let conf = 1, notes: string[] = [];
      const both = us.homeGoals !== null && us.awayGoals !== null && fd.homeGoals !== null && fd.awayGoals !== null;
      if (both) { if (us.homeGoals === fd.homeGoals && us.awayGoals === fd.awayGoals) notes.push("ok"); else { conf *= 0.7; mism++; notes.push("mismatch"); } } else notes.push("no_goals");
      if (us.homeXg === null || us.awayXg === null) conf *= 0.9; else notes.push("xg");
      rc(conf);
      const fid = computeFixtureId(c, s, us.home, us.away, us.date);
      if (seen.has(fid)) dup++; seen.add(fid);
      fixtures.push({ fixture_id: fid, season: s, competition: c, date: us.date, datetime: us.datetime, home_team: us.home, away_team: us.away, home_team_name: us.home[0].toUpperCase() + us.home.slice(1), away_team_name: us.away[0].toUpperCase() + us.away.slice(1), home_goals: fd.homeGoals !== null ? fd.homeGoals : us.homeGoals, away_goals: fd.awayGoals !== null ? fd.awayGoals : us.awayGoals, result: fd.result, home_xg: us.homeXg, away_xg: us.awayXg, home_xg_shot: null, away_xg_shot: null, odds_home: fd.odds_home, odds_draw: fd.odds_draw, odds_away: fd.odds_away, odds_over25: fd.odds_over25, odds_under25: fd.odds_under25, odds_closing_home: fd.odds_close_home, odds_closing_draw: fd.odds_close_draw, odds_closing_away: fd.odds_close_away, odds_closing_over25: fd.odds_close_over25, odds_closing_under25: fd.odds_close_under25, lineage: { understat_id: us.understatId, understat_source: "bronze/understat/" + c + "/" + s + "/matches.json", football_data_source: csvP || "", merged_at: getBuildTimestamp(), pipeline_version: getPipelineVersion(), git_commit: getGitCommit() }, confidence: conf, merge_notes: notes, checksum: computeChecksum({ fid, season: s, date: us.date }) });
    } else usOnly++;
  }
  for (const k of Object.keys(fdI)) if (!matched.has(k)) fdOnly++;
  fixtures.sort((a, b) => a.date.localeCompare(b.date) || a.home_team.localeCompare(b.home_team));
  const totalC = Object.values(confD).reduce((a, b) => a + b, 0);
  const audit: MergeAudit = { season: s, competition: c, total_understat: Object.keys(usI).length, total_football_data: Object.keys(fdI).length, merged, understat_only: usOnly, football_data_only: fdOnly, score_mismatches: mism, confidence_avg: totalC > 0 ? Object.entries(confD).reduce((s, [k, v]) => s + (k === "<0.6" ? 0.5 : +k) * v, 0) / totalC : 0, confidence_distribution: confD, duplicate_matches_detected: dup, timestamp: getBuildTimestamp(), pipeline_version: getPipelineVersion() };
  return { fixtures, audit };
}
function writeSeasonOutput(c: string, s: string, fix: SilverFixture[], audit: MergeAudit, o: any) {
  const p = path.join(o.silverBasePath!, "fixtures", c.toLowerCase(), s);
  ensureDir(p);
  writeJSON(path.join(p, "fixtures.json"), fix);
  writeJSON(path.join(p, "metadata.json"), { season: s, competition: c, fixture_count: fix.length, generated_at: getBuildTimestamp(), checksum: computeChecksum(fix), audit, pipeline_version: getPipelineVersion(), git_commit: getGitCommit(), rerun_count: 0 });
  writeJSON(path.join(p, "manifest.json"), { season: s, competition: c, fixture_count: fix.length, generated_at: getBuildTimestamp(), pipeline_version: getPipelineVersion(), git_commit: getGitCommit(), checksum: computeChecksum(fix) });
}
export async function runMergeEngine(o?: any): Promise<{ success: boolean; totalFixtures: number; seasons: string[]; errors: string[] }> {
  const opts = { competitions: DEFAULT_COMPETITIONS, seasons: DEFAULT_SEASONS, bronzeBasePath: "data/bronze", silverBasePath: "data/silver", ...o };
  const start = process.hrtime(); const errors: string[] = []; let total = 0; const seas: string[] = [];
  console.log("PHASE 1: Silver Merge Engine\\n");
  for (const c of opts.competitions!) { for (const s of opts.seasons!) {
    console.log("Processing", c, s); try {
      const { fixtures, audit } = mergeSeason(c, s, opts);
      if (fixtures.length === 0) { console.log("  No fixtures"); continue; }
      writeSeasonOutput(c, s, fixtures, audit, opts); total += fixtures.length; seas.push(s);
      console.log("  OK", fixtures.length, "fixtures | conf=", audit.confidence_avg.toFixed(2));
    } catch (err) { const msg = "Error: " + (err as Error).message; console.error(msg); errors.push(msg); }
  }}
  ensureDir(path.join(opts.silverBasePath!, "fixtures"));
  writeJSON(path.join(opts.silverBasePath!, "fixtures", "aggregate_manifest.json"), { pipeline: "silver-merge-engine", version: getPipelineVersion(), git_commit: getGitCommit(), run_at: getBuildTimestamp(), competitions: opts.competitions, seasons_completed: seas, total_fixtures: total, errors, duration_ms: elapsedMs(start) });
  console.log("Merge engine complete:", total, "fixtures"); return { success: errors.length === 0, totalFixtures: total, seasons: seas, errors };
}`);

// team-registry.ts
write("silver/team-registry.ts", `import * as path from "path";
import { readJSON, writeJSON, normalizeTeamName, computeChecksum, getPipelineVersion, getGitCommit, getBuildTimestamp, ensureDir, DEFAULT_COMPETITIONS, DEFAULT_SEASONS } from "../utils";
import type { UnderstatFixture, TeamRegistryEntry, TeamRegistry } from "../types";
const ALIASES: Record<string, string[]> = { manchester_united: ["man utd", "manchester utd"], manchester_city: ["man city", "mancity"], newcastle_united: ["newcastle", "newcastle utd"], tottenham_hotspur: ["tottenham", "spurs"], west_ham_united: ["west ham", "westham"], wolverhampton_wanderers: ["wolves", "wolverhampton"], brighton_and_hove_albion: ["brighton", "bhafc"], leicester_city: ["leicester"], nottingham_forest: ["nottingham", "nottm forest"], southampton: ["southampton fc", "saints"], crystal_palace: ["cpfc"], aston_villa: ["avfc"], everton: ["efc"], fulham: ["fulham fc"], brentford: ["brentford fc"], bournemouth: ["afc bournemouth"], leeds_united: ["leeds", "leeds utd"], norwich_city: ["norwich"], watford: ["watford fc"], burnley: ["burnley fc"], sheffield_united: ["sheffield utd"], sheffield_wednesday: ["sheffield wed"], huddersfield_town: ["huddersfield"], cardiff_city: ["cardiff"], swansea_city: ["swansea"], hull_city: ["hull"], west_bromwich_albion: ["west brom", "wba"], stoke_city: ["stoke"], middlesbrough: ["boro"], sunderland: ["safc"], wigan_athletic: ["wigan"], reading: ["reading fc"], queens_park_rangers: ["qpr"], blackburn_rovers: ["blackburn"], blackpool: ["blackpool fc"], derby_county: ["derby"], ipswich_town: ["ipswich"], luton_town: ["luton"], coventry_city: ["coventry"], millwall: ["millwall fc"], bristol_city: ["bristol"], birmingham_city: ["birmingham"], preston_north_end: ["preston", "pne"], portsmouth: ["portsmouth fc"], charlton_athletic: ["charlton"], barnsley: ["barnsley fc"], bolton_wanderers: ["bolton"], rotherham_united: ["rotherham"], wycombe_wanderers: ["wycombe"], peterborough_united: ["peterborough"], oxford_united: ["oxford"], accrington_stanley: ["accrington"], cheltenham_town: ["cheltenham"], burton_albion: ["burton"], shrewsbury_town: ["shrewsbury"], morecambe: ["morecambe fc"], fleetwood_town: ["fleetwood"], wimbledon: ["afc wimbledon", "afcwimbledon"] };
const FOUNDING: Record<string, number> = { manchester_united: 1878, manchester_city: 1880, liverpool: 1892, arsenal: 1886, chelsea: 1905, tottenham_hotspur: 1882, everton: 1878, newcastle_united: 1892, aston_villa: 1874, west_ham_united: 1895, leicester_city: 1884, leeds_united: 1919, wolverhampton_wanderers: 1877, southampton: 1885, crystal_palace: 1905, brighton_and_hove_albion: 1901, fulham: 1879, west_bromwich_albion: 1878, sunderland: 1879, stoke_city: 1863, nottingham_forest: 1865, brentford: 1889, bournemouth: 1899, burnley: 1882, watford: 1881, norwich_city: 1902, sheffield_united: 1889, huddersfield_town: 1908, cardiff_city: 1899, swansea_city: 1912, hull_city: 1904, middlesbrough: 1876, derby_county: 1884, coventry_city: 1883, birmingham_city: 1875, blackburn_rovers: 1875, bolton_wanderers: 1874, preston_north_end: 1875, portsmouth: 1898, bristol_city: 1894, ipswich_town: 1878, millwall: 1885, luton_town: 1885, sheffield_wednesday: 1867, reading: 1871, queens_park_rangers: 1882, barnsley: 1887, charlton_athletic: 1905, wigan_athletic: 1932, blackpool: 1887, rotherham_united: 1870, wycombe_wanderers: 1887, peterborough_united: 1934, oxford_united: 1893, accrington_stanley: 1968, cheltenham_town: 1887, burton_albion: 1950, shrewsbury_town: 1886, morecambe: 1920, fleetwood_town: 1908, wimbledon: 2002 };
const DC = "England";
const TCS: Record<string, string> = { england: "England", wales: "Wales" };
function exTS(c: string[], s: string[], bp: string, tn: string): string[] { const ss = new Set<string>(); for (const comp of c) { for (const season of s) { let f = readJSON<UnderstatFixture[]>(path.join(bp, "understat", comp, season, "matches.json")); if (!f) f = readJSON<UnderstatFixture[]>(path.join(bp, comp, season + "_understat.json")); if (!f) continue; for (const x of f) { const h = normalizeTeamName(x.homeTeamId || ""); const a = normalizeTeamName(x.awayTeamId || ""); if (h === tn || a === tn) ss.add(season); } } } return [...ss].sort(); }
function exUT(c: string[], s: string[], bp: string): Map<string, Set<string>> { const m = new Map<string, Set<string>>(); for (const comp of c) { for (const season of s) { let f = readJSON<UnderstatFixture[]>(path.join(bp, "understat", comp, season, "matches.json")); if (!f) f = readJSON<UnderstatFixture[]>(path.join(bp, comp, season + "_understat.json")); if (!f) continue; for (const x of f) { if (x.homeTeamId) { const n = normalizeTeamName(x.homeTeamId); if (!m.has(n)) m.set(n, new Set()); m.get(n)!.add(x.homeTeamId); } if (x.awayTeamId) { const n = normalizeTeamName(x.awayTeamId); if (!m.has(n)) m.set(n, new Set()); m.get(n)!.add(x.awayTeamId); } } } } return m; }
function cId(n: string): string { return n.toLowerCase().replace(/\\s+/g, "-").replace(/[^a-z0-9-]/g, ""); }
function buildReg(c: string[], s: string[], bp: string): TeamRegistry {
  const ts = exUT(c, s, bp); const a2c = new Map<string, string>();
  for (const [can, alis] of Object.entries(ALIASES)) { a2c.set(can, can); for (const al of alis) a2c.set(al, can); }
  const teams: TeamRegistryEntry[] = []; const procd = new Set<string>();
  for (const can of Object.keys(ALIASES)) { if (procd.has(can)) continue; procd.add(can); const alis = ALIASES[can] || []; const id = cId(can); const seas = exTS(c, s, bp, can); const src = ts.get(can); const allA = new Set(alis); if (src) src.forEach(x => allA.add(x)); teams.push({ canonical_id: id, name: can.replace(/_/g, " "), short_name: can.split("_")[0], aliases: [...allA].sort(), historical_names: [], country: TCS[can] || DC, competitions: c.slice(), seasons: seas, founded: FOUNDING[can] || null }); }
  for (const [norm, originals] of ts.entries()) { if (procd.has(norm)) continue; if (a2c.has(norm)) continue; procd.add(norm); teams.push({ canonical_id: cId(norm), name: norm, short_name: norm.split(" ")[0], aliases: [...originals].sort(), historical_names: [], country: DC, competitions: c.slice(), seasons: exTS(c, s, bp, norm), founded: FOUNDING[norm] || null }); }
  teams.sort((a, b) => a.canonical_id.localeCompare(b.canonical_id));
  const r: TeamRegistry = { version: "1.0.0", generated_at: getBuildTimestamp(), teams, pipeline_version: getPipelineVersion(), git_commit: getGitCommit(), checksum: "" };
  r.checksum = computeChecksum(r.teams); return r;
}
export async function runTeamRegistry(o?: any): Promise<{ success: boolean; teamCount: number; outputFile: string }> {
  const opts = { competitions: o?.competitions || DEFAULT_COMPETITIONS, seasons: o?.seasons || DEFAULT_SEASONS, bronzeBasePath: o?.bronzeBasePath || "data/bronze", outputPath: o?.outputPath || "data/registry" };
  const reg = buildReg(opts.competitions, opts.seasons, opts.bronzeBasePath); const f = path.join(opts.outputPath, "team_registry.json"); ensureDir(opts.outputPath); writeJSON(f, reg);
  console.log("Registry:", reg.teams.length, "teams"); return { success: true, teamCount: reg.teams.length, outputFile: f };
}`);

console.log("\\nAll EPIC 32 pipeline files written successfully!");
</write_to_file>