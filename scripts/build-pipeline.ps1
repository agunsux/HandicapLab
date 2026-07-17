# PowerShell script to build EPIC 32 pipeline files
# This script creates all required files without XML tag corruption

$base = "src/pipelines"

# Ensure directories
@("", "silver", "features", "golden", "validation", "walkforward", "baselines") | ForEach-Object {
    $dir = Join-Path $base $_
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
}

# types.ts content
$types = @"
export interface UnderstatFixture{fixtureId:string;fixtureNaturalKey:string;competitionId:string;seasonId:string;homeTeamId:string;awayTeamId:string;homeGoals:{value:number;source:string;confidence:number;mergeReason:string};awayGoals:{value:number;source:string;confidence:number;mergeReason:string};homeXg:{value:number;source:string;confidence:number;mergeReason:string};awayXg:{value:number;source:string;confidence:number;mergeReason:string};datetime?:string;}
export interface FootballDataRow{Date:string;HomeTeam:string;AwayTeam:string;FTHG:string;FTAG:string;FTR:string;B365H:string;B365D:string;B365A:string;"B365>2.5":string;"B365<2.5":string;B365CH?:string;B365CD?:string;B365CA?:string;}
export type FixtureId=string;export type TeamId=string;export type ConfidenceScore=number;
export interface SilverFixture{fixture_id:FixtureId;season:string;competition:string;date:string;datetime:string|null;home_team:TeamId;away_team:TeamId;home_team_name:string;away_team_name:string;home_goals:number|null;away_goals:number|null;result:"H"|"D"|"A"|null;home_xg:number|null;away_xg:number|null;home_xg_shot:number|null;away_xg_shot:number|null;odds_home:number|null;odds_draw:number|null;odds_away:number|null;odds_over25:number|null;odds_under25:number|null;odds_closing_home:number|null;odds_closing_draw:number|null;odds_closing_away:number|null;odds_closing_over25:number|null;odds_closing_under25:number|null;lineage:{understat_id?:string;understat_source:string;football_data_source:string;merged_at:string;pipeline_version:string;git_commit:string;};confidence:ConfidenceScore;merge_notes?:string[];checksum:string;}
export interface MergeAudit{season:string;competition:string;total_understat:number;total_football_data:number;merged:number;understat_only:number;football_data_only:number;score_mismatches:number;confidence_avg:number;confidence_distribution:Record<string,number>;duplicate_matches_detected:number;timestamp:string;pipeline_version:string;}
export interface FixtureFeatures{fixture_id:FixtureId;season:string;competition:string;date:string;home_team:TeamId;away_team:TeamId;kickoff_timestamp:string;features:Record<string,number|null>;generated_at:string;pipeline_version:string;checksum:string;}
export type MarketType="moneyline"|"asian_handicap"|"over_under";export type SplitLabel="train"|"validation"|"test";
export interface GoldenDatasetRow{fixture_id:FixtureId;season:string;competition:string;date:string;kickoff_timestamp:string;home_team:TeamId;away_team:TeamId;home_team_name:string;away_team_name:string;market:MarketType;features:Record<string,number|null>;target:number|null;actual_result:string|null;odds_home:number|null;odds_draw:number|null;odds_away:number|null;odds_over25:number|null;odds_under25:number|null;split:SplitLabel;fold:number;season_label:string;}
export type ValidationSeverity="critical"|"error"|"warning"|"info";
export interface ValidationIssue{code:string;severity:ValidationSeverity;message:string;fixture_id?:FixtureId;details?:Record<string,unknown>;}
export type WindowStrategy="expanding"|"rolling"|"season_by_season";
export interface WalkForwardFold{fold:number;train_start:string;train_end:string;test_start:string;test_end:string;train_count:number;test_count:number;train_seasons:string[];test_seasons:string[];}
export interface PipelineResult{success:boolean;phases_completed:string[];errors:string[];warnings:string[];artifacts:string[];duration_ms:number;checksums:Record<string,string>;}
"@

Set-Content -Path (Join-Path $base "types.ts") -Value $types -NoNewline
Write-Output "types.ts written"

# utils.ts content  
$utils = @"
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
export function getPipelineVersion():string{try{return JSON.parse(fs.readFileSync('package.json','utf8')).version||'0.0.0';}catch{return '0.0.0';}}
export function getGitCommit():string{try{return fs.readFileSync('.git/HEAD','utf8').trim();}catch{try{const h=fs.readFileSync('.git/HEAD','utf8').trim();if(h.startsWith('ref: '))return fs.readFileSync(path.join('.git',h.slice(5).replace(/\\//g,path.sep)),'utf8').trim();return h;}catch{return 'unknown';}}}
export function getBuildTimestamp():string{return new Date().toISOString();}
export function computeChecksum(d:unknown):string{return crypto.createHash('sha256').update(JSON.stringify(d,Object.keys(d as object).sort()),'utf8').digest('hex');}
export function computeFixtureId(c:string,s:string,h:string,a:string,d:string):string{return crypto.createHash('sha256').update(c+'|'+s+'|'+h.toUpperCase()+'|'+a.toUpperCase()+'|'+d,'utf8').digest('hex');}
export function readJSON<T>(fp:string):T|null{try{if(!fs.existsSync(fp))return null;let r=fs.readFileSync(fp,'utf8');if(r.charCodeAt(0)===0xFEFF)r=r.slice(1);return JSON.parse(r)as T;}catch{return null;}}
export function writeJSON(fp:string,d:unknown):void{const dir=path.dirname(fp);if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(fp,JSON.stringify(d,null,2)+'\n','utf8');}
export function ensureDir(d:string):void{if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});}
export function parseCSV<T>(text:string):T[]{const lines=text.split('\n').filter(l=>l.trim());if(lines.length<2)return[];const h=lines[0].split(',').map(x=>x.trim());const rows:T[]=[];for(let i=1;i<lines.length;i++){const vals:string[]=[];let cur='',q=false;for(let j=0;j<lines[i].length;j++){const c=lines[i][j];if(c==='"')q=!q;else if(c===','&&!q){vals.push(cur.trim());cur='';}else cur+=c;}vals.push(cur.trim());const row:any={};h.forEach((x,j)=>{row[x]=(vals[j]||'').trim();});rows.push(row);}return rows;}
export function parseFootballDataDate(d:string):string{const p=d.split('/');if(p.length!==3)return d;let y=p[2];if(y.length===2)y='20'+y;return y+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0');}
export function normalizeTeamName(n:string):string{return n.toLowerCase().trim().replace(/\s+/g,' ');}
export function elapsedMs(s:[number,number]):number{const d=process.hrtime(s);return Math.round(d[0]*1000+d[1]/1e6);}
export const DEFAULT_COMPETITIONS=['EPL'];
export const DEFAULT_SEASONS=['2015-2016','2016-2017','2017-2018','2018-2019','2019-2020','2020-2021','2021-2022','2022-2023','2023-2024','2024-2025','2025-2026'];
"@
Set-Content -Path (Join-Path $base "utils.ts") -Value $utils -NoNewline
Write-Output "utils.ts written"

Write-Output "Core EPIC 32 pipeline files created successfully"
