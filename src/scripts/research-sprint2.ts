// Research Sprint 2 — Entry Point
import 'dotenv/config';import*as fs from 'fs';import*as path from 'path';import{execSync}from'child_process';
import{loadAllData}from'../lib/research/loader';
import{runWalkForward,settlePredictions,computeMetrics,bootstrapMetrics,runBaselines,seasonBreakdown}from'../lib/research/pipeline';

const C={version:'1.0',leagues:['EPL','Bundesliga','Serie A','La Liga','Ligue 1']as string[],seasons:['2020-2021','2021-2022','2022-2023','2023-2024','2024-2025']as string[],bootstrapResamples:10000,successRoiThreshold:0.02,successEceThreshold:0.05,successClvPValue:0.05,minSeasonsForConsistency:4,modelVersion:'research-v1'};
function rid(){return new Date().toISOString().replace(/:/g,'-').replace(/\.\d+Z$/,'Z');}
function gc(){try{return execSync('git rev-parse HEAD',{encoding:'utf8',cwd:process.cwd()}).trim();}catch{return'unknown';}}

async function main(){
  const t0=Date.now(),id=rid(),dir=path.join(process.cwd(),'research_runs',id);fs.mkdirSync(dir,{recursive:true});
  const sv=(n:string,d:any)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(d,null,2),'utf8');
  const{matches,hashes,totalFiles}=loadAllData(C.leagues,C.seasons);
  if(totalFiles===0||matches.length===0){console.error('[FATAL] No data');process.exit(1);}
  sv('dataset_hash.json',{hashes,totalMatches:matches.length});
  const preds=runWalkForward(matches);sv('predictions.json',preds);
  const settled=settlePredictions(preds);sv('settled.json',settled);
  const bl=runBaselines(matches);
  sv('baselines.json',bl.map(b=>({name:b.name,count:b.rows.length,metrics:computeMetrics(b.rows)})));
  const M=computeMetrics(settled);sv('metrics.json',M);
  const B=bootstrapMetrics(settled,C.bootstrapResamples);sv('bootstrap.json',B);
  const seas=seasonBreakdown(settled);sv('season_breakdown.json',seas);
  const he=M.roi>C.successRoiThreshold&&M.avgCLV>0&&M.clvPValue<C.successClvPValue&&M.ece<C.successEceThreshold&&B.roiLower>0;
  const meta={run_id:id,git_commit:gc(),manifest_version:C.version,model_version:C.modelVersion,dataset_hash:hashes,seed:42,generated_at:new Date().toISOString(),node_version:process.version,execution_seconds:((Date.now()-t0)/1000),total_matches:matches.length,total_bets:settled.length};
  sv('metadata.json',meta);sv('manifest.json',C);const blMD=bl.map(b=>{const m=computeMetrics(b.rows);return`| ${b.name} | ${m.totalBets} | ${(m.roi*100).toFixed(2)}% | ${(m.winRate*100).toFixed(1)}% | ${(m.avgCLV*100).toFixed(2)}% | ${m.brierScore.toFixed(4)} | ${m.logLoss.toFixed(4)} | ${(m.ece*100).toFixed(2)}% |`;}).join('\\n');
  const sl=seas.map(s=>`| ${s.season} | ${s.totalBets} | ${(s.roi*100).toFixed(2)}% | ${(s.clv*100).toFixed(2)}% | ${(s.ece*100).toFixed(2)}% |`).join('\\n');
  const md=`# Research Sprint 2\n**Run:** ${id}**Model:** ${C.modelVersion}\n\n## Verdict\n${he?'EDGE':'NO EDGE'}\n\n## Primary\n|Metric|Value|\n|-|-|\n|ROI|${(M.roi*100).toFixed(2)}%|\n|CLV|${(M.avgCLV*100).toFixed(4)}% p=${M.clvPValue.toFixed(6)}|\n|ECE|${(M.ece*100).toFixed(2)}%|\n|Bets|${M.totalBets}|\n\n## Baseline\n|Model|Bets|ROI|Win%|CLV|Brier|LL|ECE|\n|-|-|-|-|-|-|-|-|\n|**Model**|${M.totalBets}|**${(M.roi*100).toFixed(2)}%**|${(M.winRate*100).toFixed(1)}%|${(M.avgCLV*100).toFixed(2)}%|${M.brierScore.toFixed(4)}|${M.logLoss.toFixed(4)}|${(M.ece*100).toFixed(2)}%|\n${blMD}\n\n## Seasons\n|Season|Bets|ROI|CLV|ECE|\n|-|-|-|-|-|\n${sl}\n\n## Criteria\n|Criterion|Actual|Pass|\n|-|-|-|\n|ROI>2%|${(M.roi*100).toFixed(2)}%|${M.roi>C.successRoiThreshold?'Y':'N'}|\n|CLV>0p<0.05|p=${M.clvPValue.toFixed(6)}|${M.avgCLV>0&&M.clvPValue<C.successClvPValue?'Y':'N'}|\n|Bootstrap>0|${(B.roiLower*100).toFixed(2)}%|${B.roiLower>0?'Y':'N'}|\n\n*Auto.*`;
  fs.writeFileSync(path.join(dir,'report.md'),md,'utf8');
  console.log(`\nROI:${(M.roi*100).toFixed(2)}% CLV:${(M.avgCLV*100).toFixed(4)}% p=${M.clvPValue.toFixed(6)} | Bets:${M.totalBets} | Win:${(M.winRate*100).toFixed(1)}% | Profit:${M.totalProfit.toFixed(2)} | ECE:${(M.ece*100).toFixed(2)}% | BL:${bl.map(b=>`${b.name}=${(computeMetrics(b.rows).roi*100).toFixed(2)}%`).join(',')} | Bootstrap:${(B.roiCI[0]*100).toFixed(2)}-${(B.roiCI[1]*100).toFixed(2)}% | Edge:${he?'YES':'NO'}`);
  process.exit(0);
}
main().catch(e=>{console.error('[FATAL]',e);process.exit(1);});
