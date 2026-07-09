// Pipeline — Walk-Forward & Settlement Engine
import { MatchRecord } from './loader';
import { TeamRatings } from './ratings';
import { generatePrediction } from '../../services/probability.engine';
import { removeVig, calculateECE, logLoss as L, brierScore as B, normalCDF } from '../math/metrics';
export interface PredictionRow {
  predictionId: string; timestamp: string; matchDate: string;
  league: string; season: string; homeTeam: string; awayTeam: string; modelVersion: string;
  homeProb: number; drawProb: number; awayProb: number;
  selectedSide: 'home'|'away'|null; odds: number|null; ev: number|null; stake: number|null;
  closingOddsHome: number; closingOddsDraw: number; closingOddsAway: number;
  openingOddsHome: number; openingOddsDraw: number; openingOddsAway: number;
  actualOutcome: 'home'|'draw'|'away'|null; isWin: boolean|null; profit: number|null;
}
export interface SettlementRow {
  predictionId: string; timestamp: string; season: string; league: string;
  homeTeam: string; awayTeam: string;
  modelProb: number; odds: number; ev: number; stake: number; closingOdds: number; openingOdds: number;
  side: string; actual: string; isWin: boolean; profit: number;
  roi: number; clv: number; brierScore: number; logLoss: number;
}
export interface MetricsResult {
  roi: number; yieldPct: number; winRate: number; totalBets: number;
  totalProfit: number; totalStake: number; avgEV: number; avgCLV: number; clvPValue: number;
  ece: number; brierScore: number; logLoss: number;
}
export interface BootstrapResult { roiCI: [number,number]; clvCI: [number,number]; roiLower: number; roiUpper: number; }

export interface PredictModelResult {
  hp: number;
  dp: number;
  ap: number;
  side: 'home' | 'away' | null;
  ev: number;
  odds: number | null;
}

export interface SeasonBreakdownRow {
  season: string;
  totalBets: number;
  winRate: number;
  roi: number;
  clv: number;
  clvPValue: number;
  ece: number;
  brierScore: number;
  logLoss: number;
  profit: number;
}

interface BaselineFnResult {
  side: 'home' | 'away';
  prob: number;
  odds: number;
}

const EV=0.05, SK=1;

export function runWalkForward(matches:MatchRecord[]):PredictionRow[]{
  const out:PredictionRow[]=[]; const ratings=new TeamRatings();
  const wSize=Math.floor(matches.length*0.2),step=Math.floor(matches.length*0.1);
  for(let s=0;s+wSize<=matches.length;s+=step){
    const vs=s+Math.floor(matches.length*0.7),ve=Math.min(matches.length,vs+wSize);
    if(vs>=matches.length||ve<=vs) break;
    for(let i=0;i<vs;i++) ratings.update(matches[i]);
    for(let i=vs;i<ve;i++){
      const m=matches[i],r=predictModel(m,ratings);
      const ao=m.ftr==='H'?'home':m.ftr==='A'?'away':'draw';
      const iw=r.side?r.side===ao:null;
      const pft=iw===true?(r.odds||1)-1:iw===false?-SK:null;
      out.push({predictionId:`pred_${out.length}`,timestamp:new Date().toISOString(),matchDate:m.date.toISOString(),
        league:m.league,season:m.season,homeTeam:m.homeTeam,awayTeam:m.awayTeam,modelVersion:'v0.5-ai',
        homeProb:r.hp,drawProb:r.dp,awayProb:r.ap,selectedSide:r.side,odds:r.odds,ev:r.ev,stake:r.side?SK:null,
        closingOddsHome:m.psch||2,closingOddsDraw:m.pscd||3.5,closingOddsAway:m.psca||4,
        openingOddsHome:m.psh||m.psch||2,openingOddsDraw:m.psd||m.pscd||3.5,openingOddsAway:m.psa||m.psca||4,
        actualOutcome:ao,isWin:iw,profit:pft});
    }
    for(let i=vs;i<ve;i++) ratings.update(matches[i]);
  }
  return out;
}

export function settlePredictions(predictions:PredictionRow[]):SettlementRow[]{
  return predictions.filter(p=>p.selectedSide&&p.odds!==null).map(p=>{
    const cl=p.selectedSide==='home'?p.closingOddsHome:p.closingOddsAway;
    const op=p.selectedSide==='home'?p.openingOddsHome:p.openingOddsAway;
    const pb=p.selectedSide==='home'?p.homeProb:p.awayProb;
    return {predictionId:p.predictionId,timestamp:p.timestamp,season:p.season,league:p.league,
      homeTeam:p.homeTeam,awayTeam:p.awayTeam,modelProb:pb,odds:p.odds!,ev:p.ev!,stake:p.stake!,
      closingOdds:cl,openingOdds:op,side:p.selectedSide!,actual:p.actualOutcome||'unknown',
      isWin:p.isWin!,profit:p.profit!,roi:p.profit!/p.stake!,
      clv:op>0&&cl>0?(cl/op)-1:0,brierScore:B(pb,p.isWin?1:0),logLoss:L(pb,p.isWin?1:0)};
  });
}

function predictModel(match:MatchRecord,ratings:TeamRatings):PredictModelResult{
  const input=ratings.createMatchInput(match);
  const pred=generatePrediction(input);
  const {homeProb:fh,awayProb:fa}=removeVig(match.psch||2,match.pscd||3.5,match.psca||4);
  const hEV=pred.ml_home_prob*(1/fh)-1,aEV=pred.ml_away_prob*(1/fa)-1;
  if(hEV>=EV&&hEV>aEV) return {hp:pred.ml_home_prob,dp:pred.ml_draw_prob,ap:pred.ml_away_prob,side:'home',ev:hEV,odds:1/fh};
  if(aEV>=EV&&aEV>hEV) return {hp:pred.ml_home_prob,dp:pred.ml_draw_prob,ap:pred.ml_away_prob,side:'away',ev:aEV,odds:1/fa};
  return {hp:pred.ml_home_prob,dp:pred.ml_draw_prob,ap:pred.ml_away_prob,side:null,ev:0,odds:null};
}

export function computeMetrics(rows:SettlementRow[]):MetricsResult{
  if(rows.length===0) return {roi:0,yieldPct:0,winRate:0,totalBets:0,totalProfit:0,totalStake:0,avgEV:0,avgCLV:0,clvPValue:1,ece:0,brierScore:0,logLoss:0};
  const tp=rows.reduce((s,r)=>s+r.profit,0),ts=rows.reduce((s,r)=>s+r.stake,0);
  const wins=rows.filter(r=>r.isWin).length,cv=rows.map(r=>r.clv),cm=cv.reduce((s,v)=>s+v,0)/cv.length;
  const se=Math.sqrt(cv.reduce((s,v)=>s+(v-cm)**2,0)/Math.max(1,cv.length-1)/cv.length);
  return {roi:ts>0?tp/ts:0,yieldPct:ts>0?(tp/ts)*100:0,winRate:wins/rows.length,totalBets:rows.length,totalProfit:tp,totalStake:ts,
    avgEV:rows.reduce((s,r)=>s+r.ev,0)/rows.length,avgCLV:cm,clvPValue:2*(1-normalCDF(Math.abs(se>0?cm/se:0))),
    ece:calculateECE(rows.map(r=>r.modelProb),rows.map(r=>r.isWin?1:0)),
    brierScore:rows.reduce((s,r)=>s+r.brierScore,0)/rows.length,logLoss:rows.reduce((s,r)=>s+r.logLoss,0)/rows.length};
}

export function bootstrapMetrics(rows:SettlementRow[],n:number=10000):BootstrapResult{
  const rs:number[]=[],cs:number[]=[];const len=rows.length;
  if(len===0) return {roiCI:[0,0],clvCI:[0,0],roiLower:0,roiUpper:0};
  for(let b=0;b<n;b++){let sp=0,ss=0,sc=0;for(let i=0;i<len;i++){const idx=Math.floor(Math.random()*len);sp+=rows[idx].profit;ss+=rows[idx].stake;sc+=rows[idx].clv;}rs.push(ss>0?sp/ss:0);cs.push(sc/len);}
  rs.sort((a,b)=>a-b);cs.sort((a,b)=>a-b);
  const li=Math.floor(n*0.025),ui=Math.floor(n*0.975);
  return {roiCI:[rs[li]||0,rs[ui]||0],clvCI:[cs[li]||0,cs[ui]||0],roiLower:rs[li]||0,roiUpper:rs[ui]||0};
}

export function runBaselines(matches:MatchRecord[]):Array<{name:string;rows:SettlementRow[]}>{
  const D:Array<{name:string;fn:(m:MatchRecord)=>BaselineFnResult | null}>=[
    {name:'Closing Odds',fn:(m)=>{const p=removeVig(m.psch||2,m.pscd||3.5,m.psca||4);const mx=Math.max(p.homeProb,p.drawProb,p.awayProb);const s=mx===p.homeProb?'home':mx===p.awayProb?'away':null;if(!s||s==='draw')return null;return {side:s,prob:mx,odds:s==='home'?1/p.homeProb:1/p.awayProb};}},
    {name:'Opening Odds',fn:(m)=>{const p=removeVig(m.psh||m.psch||2,m.psd||m.pscd||3.5,m.psa||m.psca||4);const mx=Math.max(p.homeProb,p.drawProb,p.awayProb);const s=mx===p.homeProb?'home':mx===p.awayProb?'away':null;if(!s||s==='draw')return null;return {side:s,prob:mx,odds:s==='home'?1/p.homeProb:1/p.awayProb};}},
    {name:'Always Home',fn:()=>({side:'home',prob:0.48,odds:2})},{name:'Always Away',fn:()=>({side:'away',prob:0.48,odds:4})},
    {name:'Market Implied',fn:(m)=>{const p=removeVig(m.psch||2,m.pscd||3.5,m.psca||4);return {side:'home',prob:p.homeProb,odds:1/p.homeProb};}},
    {name:'Flat 50%',fn:(m)=>{const p=removeVig(m.psch||2,m.pscd||3.5,m.psca||4);const f=p.homeProb>=0.5;return {side:f?'home':'away',prob:0.5,odds:f?1/p.homeProb:1/p.awayProb};}},
  ];
  return D.map(d=>{const rows:SettlementRow[]=[];for(const m of matches){const r=d.fn(m);if(!r)continue;const ao=m.ftr==='H'?'home':m.ftr==='A'?'away':'draw';if(r.side==='draw')continue;const iw=r.side===ao;const pft=iw?r.odds-1:-1;rows.push({predictionId:'',timestamp:'',season:m.season,league:m.league,homeTeam:m.homeTeam,awayTeam:m.awayTeam,modelProb:r.prob,odds:r.odds,ev:r.prob*r.odds-1,stake:1,closingOdds:r.odds,openingOdds:r.odds,side:r.side,actual:ao,isWin:iw,profit:pft,roi:pft,clv:0,brierScore:B(r.prob,iw?1:0),logLoss:L(r.prob,iw?1:0)});}return {name:d.name,rows};});
}

export function seasonBreakdown(rows:SettlementRow[]):SeasonBreakdownRow[]{
  const map=new Map<string,SettlementRow[]>();
  for(const r of rows){if(!map.has(r.season))map.set(r.season,[]);map.get(r.season)!.push(r);}
  return Array.from(map.entries()).map(([s,rs])=>{const m=computeMetrics(rs);return{season:s,totalBets:m.totalBets,winRate:m.winRate,roi:m.roi,clv:m.avgCLV,clvPValue:m.clvPValue,ece:m.ece,brierScore:m.brierScore,logLoss:m.logLoss,profit:m.totalProfit};}).sort((a,b)=>a.season.localeCompare(b.season));
}
