const fs = require('fs');
const path = require('path');

const BASE = 'src/pipelines';
const dirs = ['', 'silver', 'features', 'golden', 'validation', 'walkforward', 'baselines'];
dirs.forEach(d => {
  const p = path.join(BASE, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ── types.ts ──
let content = `export interface UnderstatFixture {
  fixtureId: string; fixtureNaturalKey: string; competitionId: string; seasonId: string;
  homeTeamId: string; awayTeamId: string;
  homeGoals: { value: number; source: string; confidence: number; mergeReason: string };
  awayGoals: { value: number; source: string; confidence: number; mergeReason: string };
  homeXg: { value: number; source: string; confidence: number; mergeReason: string };
  awayXg: { value: number; source: string; confidence: number; mergeReason: string };
  datetime?: string;
}
export interface FootballDataRow {
  Date: string; HomeTeam: string; AwayTeam: string; FTHG: string; FTAG: string; FTR: string;
  B365H: string; B365D: string; B365A: string;
  'B365>2.5': string; 'B365<2.5': string;
  B365CH?: string; B365CD?: string; B365CA?: string;
}
export type FixtureId = string;
export type TeamId = string;
export type ConfidenceScore = number;
export interface SilverFixture {
  fixture_id: FixtureId; season: string; competition: string;
  date: string; datetime: string | null;
  home_team: TeamId; away_team: TeamId;
  home_team_name: string; away_team_name: string;
  home_goals: number | null; away_goals: number | null;
  result: 'H' | 'D' | 'A' | null;
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
export type MarketType = 'moneyline' | 'asian_handicap' | 'over_under';
export type SplitLabel = 'train' | 'validation' | 'test';
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
export type ValidationSeverity = 'critical' | 'error' | 'warning' | 'info';
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
export type WindowStrategy = 'expanding' | 'rolling' | 'season_by_season';
export interface WalkForwardFold {
  fold: number; train_start: string; train_end: string;
  test_start: string; test_end: string;
  train_count: number; test_count: number;
  train_seasons: string[]; test_seasons: string[];
}
`;
fs.writeFileSync(path.join(BASE, 'types.ts'), content);
console.log('types.ts written');

// ── utils.ts ──
content = `import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export function getPipelineVersion(): string {
  try { const pkg = JSON.parse(fs.readFileSync('package.json','utf8')); return pkg.version||'0.0.0'; }
  catch { return '0.0.0'; }
}
export function getGitCommit(): string {
  try { return fs.readFileSync('.git/HEAD','utf8').trim(); }
  catch { try { const h=fs.readFileSync('.git/HEAD','utf8').trim(); if(h.startsWith('ref: ')) return fs.readFileSync(path.join('.git',h.slice(5).replace(/\\//g,path.sep)),'utf8').trim(); return h; } catch { return 'unknown'; } }
}
export function getBuildTimestamp(): string { return new Date().toISOString(); }
export function computeChecksum(d:unknown):string{return crypto.createHash('sha256').update(JSON.stringify(d,Object.keys(d as object).sort()),'utf8').digest('hex');}
export function computeFixtureId(c:string,s:string,h:string,a:string,d:string):string{return crypto.createHash('sha256').update(c+'|'+s+'|'+h.toUpperCase()+'|'+a.toUpperCase()+'|'+d,'utf8').digest('hex');}
export function readJSON<T>(fp:string):T|null{try{if(!fs.existsSync(fp))return null;let r=fs.readFileSync(fp,'utf8');if(r.charCodeAt(0)===0xFEFF)r=r.slice(1);return JSON.parse(r)as T;}catch{return null;}}
export function writeJSON(fp:string,d:unknown):void{const dir=path.dirname(fp);if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(fp,JSON.stringify(d,null,2)+'\\n','utf8');}
export function ensureDir(d:string):void{if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});}
export function parseCSV<T>(text:string):T[]{const lines=text.split('\\n').filter(l=>l.trim());if(lines.length<2)return[];const h=lines[0].split(',').map(x=>x.trim());const rows:T[]=[];for(let i=1;i<lines.length;i++){const vals:string[]=[];let cur='',q=false;for(let j=0;j<lines[i].length;j++){const c=lines[i][j];if(c==='\"')q=!q;else if(c===','&&!q){vals.push(cur.trim());cur='';}else cur+=c;}vals.push(cur.trim());const row:any={};h.forEach((x,j)=>{row[x]=(vals[j]||'').trim();});rows.push(row);}return rows;}
export function parseFootballDataDate(d:string):string{const p=d.split('/');if(p.length!==3)return d;let y=p[2];if(y.length===2)y='20'+y;return y+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0');}
export function normalizeTeamName(n:string):string{return n.toLowerCase().trim().replace(/\\s+/g,' ');}
export function elapsedMs(s:[number,number]):number{const d=process.hrtime(s);return Math.round(d[0]*1000+d[1]/1e6);}
export const DEFAULT_COMPETITIONS=['EPL'];
export const DEFAULT_SEASONS=['2015-2016','2016-2017','2017-2018','2018-2019','2019-2020','2020-2021','2021-2022','2022-2023','2023-2024','2024-2025','2025-2026'];
export const BASELINE_MODELS=['poisson','dixon_coles','logistic_regression','random_forest','gradient_boosting'];
`;
fs.writeFileSync(path.join(BASE, 'utils.ts'), content);
console.log('utils.ts written');

// ── silver/team-registry.ts ──
content = `import * as path from 'path';
import { readJSON, writeJSON, normalizeTeamName, computeChecksum, getPipelineVersion, getGitCommit, getBuildTimestamp, ensureDir, DEFAULT_COMPETITIONS, DEFAULT_SEASONS } from '../utils';
import type { UnderstatFixture, TeamRegistryEntry, TeamRegistry } from '../types';

const KNOWN_ALIASES: Record<string,string[]> = {
  'manchester united':['man utd','manchester utd'],'manchester city':['man city','mancity'],
  'newcastle united':['newcastle','newcastle utd'],'tottenham hotspur':['tottenham','spurs'],
  'west ham united':['west ham','westham'],'wolverhampton wanderers':['wolves','wolverhampton'],
  'brighton and hove albion':['brighton','bhafc'],'leicester city':['leicester'],
  'nottingham forest':['nottingham','nottm forest'],'southampton':['southampton fc','saints'],
  'crystal palace':['cpfc'],'aston villa':['avfc'],'everton':['efc'],'fulham':['fulham fc'],
  'brentford':['brentford fc'],'bournemouth':['afc bournemouth'],'leeds united':['leeds','leeds utd'],
  'norwich city':['norwich'],'watford':['watford fc'],'burnley':['burnley fc'],
  'sheffield united':['sheffield utd'],'sheffield wednesday':['sheffield wed'],
  'huddersfield town':['huddersfield'],'cardiff city':['cardiff'],'swansea city':['swansea'],
  'hull city':['hull'],'west bromwich albion':['west brom','wba'],'stoke city':['stoke'],
  'middlesbrough':['boro'],'sunderland':['safc'],'wigan athletic':['wigan'],'reading':['reading fc'],
  'queens park rangers':['qpr'],'blackburn rovers':['blackburn'],'blackpool':['blackpool fc'],
  'derby county':['derby'],'ipswich town':['ipswich'],'luton town':['luton'],
  'coventry city':['coventry'],'millwall':['millwall fc'],'bristol city':['bristol'],
  'birmingham city':['birmingham'],'preston north end':['preston','pne'],'portsmouth':['portsmouth fc'],
  'charlton athletic':['charlton'],'barnsley':['barnsley fc'],'bolton wanderers':['bolton'],
  'rotherham united':['rotherham'],'wycombe wanderers':['wycombe'],'peterborough united':['peterborough'],
  'oxford united':['oxford'],'accrington stanley':['accrington'],'cheltenham town':['cheltenham'],
  'burton albion':['burton'],'shrewsbury town':['shrewsbury'],'morecambe':['morecambe fc'],
  'fleetwood town':['fleetwood'],'wimbledon':['afc wimbledon','afcwimbledon']
};

const KNOWN_FOUNDING: Record<string,number> = {
  'manchester united':1878,'manchester city':1880,'liverpool':1892,'arsenal':1886,'chelsea':1905,
  'tottenham hotspur':1882,'everton':1878,'newcastle united':1892,'aston villa':1874,'west ham united':1895,
  'leicester city':1884,'leeds united':1919,'wolverhampton wanderers':1877,'southampton':1885,
  'crystal palace':1905,'brighton and hove albion':1901,'fulham':1879,'west bromwich albion':1878,
  'sunderland':1879,'stoke city':1863,'nottingham forest':1865,'brentford':1889,'bournemouth':1899,
  'burnley':1882,'watford':1881,'norwich city':1902,'sheffield united':1889,'huddersfield town':1908,
  'cardiff city':1899,'swansea city':1912,'hull city':1904,'middlesbrough':1876,'derby county':1884,
  'coventry city':1883,'birmingham city':1875,'blackburn rovers':1875,'bolton wanderers':1874,
  'preston north end':1875,'portsmouth':1898,'bristol city':1894,'ipswich town':1878,'millwall':1885,
  'luton town':1885,'sheffield wednesday':1867,'reading':1871,'queens park rangers':1882,'barnsley':1887,
  'charlton athletic':1905,'wigan athletic':1932,'blackpool':1887,'rotherham united':1870,
  'wycombe wanderers':1887,'peterborough united':1934,'oxford united':1893,'accrington stanley':1968,
  'cheltenham town':1887,'burton albion':1950,'shrewsbury town':1886,'morecambe':1920,'fleetwood town':1908,'wimbledon':2002
};
const DEFAULT_COUNTRY = 'England';
const TEAM_COUNTRIES: Record<string,string> = { 'england':'England','wales':'Wales' };
function extractUnderstatTeams(c:string[],s:string[],bp:string):Map<string,Set<string>>{const m=new Map();for(const comp of c){for(const season of s){let f=readJSON<UnderstatFixture[]>(path.join(bp,'understat',comp,season,'matches.json'));if(!f)f=readJSON<UnderstatFixture[]>(path.join(bp,comp,season+'_understat.json'));if(!f)continue;for(const x of f){if(x.homeTeamId){const n=normalizeTeamName(x.homeTeamId);if(!m.has(n))m.set(n,new Set());m.get(n)!.add(x.homeTeamId);}if(x.awayTeamId){const n=normalizeTeamName(x.awayTeamId);if(!m.has(n))m.set(n,new Set());m.get(n)!.add(x.awayTeamId);}}}}return m;}
function extractTeamSeasons(c:string[],s:string[],bp:string,tn:string):string[]{const ss=new Set<string>();for(const comp of c){for(const season of s){let f=readJSON<UnderstatFixture[]>(path.join(bp,'understat',comp,season,'matches.json'));if(!f)f=readJSON<UnderstatFixture[]>(path.join(bp,comp,season+'_understat.json'));if(!f)continue;for(const x of f){const h=normalizeTeamName(x.homeTeamId||'');const a=normalizeTeamName(x.awayTeamId||'');if(h===tn||a===tn)ss.add(season);}}}return [...ss].sort();}
function computeId(n:string):string{return n.toLowerCase().replace(/\\s+/g,'-').replace(/[^a-z0-9-]/g,'');}
function buildRegistry(c:string[],s:string[],bp:string):TeamRegistry{
  const ts=extractUnderstatTeams(c,s,bp);const a2c=new Map<string,string>();for(const[can,alis]of Object.entries(KNOWN_ALIASES)){a2c.set(can,can);for(const al of alis)a2c.set(al,can);}
  const teams:TeamRegistryEntry[]=[];const processed=new Set<string>();
  for(const can of Object.keys(KNOWN_ALIASES)){if(processed.has(can))continue;processed.add(can);const alis=KNOWN_ALIASES[can]||[];const id=computeId(can);const seas=extractTeamSeasons(c,s,bp,can);const src=ts.get(can);const allA=new Set(alis);if(src)src.forEach(x=>allA.add(x));teams.push({canonical_id:id,name:can,short_name:can.split(' ')[0],aliases:[...allA].sort(),historical_names:[],country:TEAM_COUNTRIES[can]||DEFAULT_COUNTRY,competitions:c.slice(),seasons:seas,founded:KNOWN_FOUNDING[can]||null});}
  for(const[norm,originals]of ts.entries()){if(processed.has(norm))continue;if(a2c.has(norm))continue;processed.add(norm);teams.push({canonical_id:computeId(norm),name:norm,short_name:norm.split(' ')[0],aliases:[...originals].sort(),historical_names:[],country:DEFAULT_COUNTRY,competitions:c.slice(),seasons:extractTeamSeasons(c,s,bp,norm),founded:KNOWN_FOUNDING[norm]||null});}
  teams.sort((a,b)=>a.canonical_id.localeCompare(b.canonical_id));const r:TeamRegistry={version:'1.0.0',generated_at:getBuildTimestamp(),teams,pipeline_version:getPipelineVersion(),git_commit:getGitCommit(),checksum:''};r.checksum=computeChecksum(r.teams);return r;
}
export async function runTeamRegistry(o?:{competitions?:string[];seasons?:string[];bronzeBasePath?:string;outputPath?:string}):Promise<{success:boolean;teamCount:number;outputFile:string}>{
  const opts={competitions:o?.competitions||DEFAULT_COMPETITIONS,seasons:o?.seasons||DEFAULT_SEASONS,bronzeBasePath:o?.bronzeBasePath||'data/bronze',outputPath:o?.outputPath||'data/registry'};
  const reg=buildRegistry(opts.competitions,opts.seasons,opts.bronzeBasePath);const f=path.join(opts.outputPath,'team_registry.json');ensureDir(opts.outputPath);writeJSON(f,reg);
  console.log('Team Registry:',reg.teams.length,'teams');return{success:true,teamCount:reg.teams.length,outputFile:f};
}
`;
fs.writeFileSync(path.join(BASE, 'silver/team-registry.ts'), content);
console.log('silver/team-registry.ts written');

console.log('\\nAll base files written successfully!');
</write_to_file>