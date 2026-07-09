// Sprint 3 Analytics — Robustness, Regime, Risk Metrics
import { SettlementRow, computeMetrics, MetricsResult } from './pipeline';

export interface RiskMetrics {
  sharpeRatio: number; sortinoRatio: number; maxDrawdown: number; maxDrawdownPct: number;
  profitFactor: number; kellyGrowthRate: number; longestWinStreak: number;
  longestLoseStreak: number; expectedLoseStreak: number; avgProfitPerBet: number; profitVariance: number;
}
export interface RegimeResult { regime: string; bets: number; wins: number; roi: number; clv: number; ece: number; }
export interface RobustnessResult { metric: string; mean: number; stdDev: number; min: number; max: number; stabilityScore: number; }

export function computeRiskMetrics(rows: SettlementRow[]): RiskMetrics {
  if(rows.length<2) return {sharpeRatio:0,sortinoRatio:0,maxDrawdown:0,maxDrawdownPct:0,profitFactor:0,kellyGrowthRate:0,longestWinStreak:0,longestLoseStreak:0,expectedLoseStreak:0,avgProfitPerBet:0,profitVariance:0};
  const profits=rows.map(r=>r.profit), avgP=profits.reduce((s,v)=>s+v,0)/profits.length;
  const variance=profits.reduce((s,v)=>s+(v-avgP)**2,0)/(profits.length-1), stdDev=Math.sqrt(variance);
  const negP=profits.filter(p=>p<0), downV=negP.reduce((s,v)=>s+(v-avgP)**2,0)/Math.max(1,negP.length-1);
  const sharpe=stdDev>0?(avgP-0.02/365)/stdDev:0, sortino=Math.sqrt(downV)>0?(avgP-0.02/365)/Math.sqrt(downV):0;
  let cum=0,peak=0,maxDD=0; for(const p of profits){cum+=p;if(cum>peak)peak=cum;maxDD=Math.max(maxDD,peak-cum);}
  const tp=rows.reduce((s,r)=>s+r.profit,0), tl=rows.filter(r=>r.profit<0).reduce((s,r)=>s+Math.abs(r.profit),0);
  let ws=0,ls=0,mws=0,mls=0; for(const r of rows){if(r.isWin){ws++;ls=0;mws=Math.max(mws,ws);}else{ls++;ws=0;mls=Math.max(mls,ls);}}
  const wp=rows.filter(r=>r.isWin).length/rows.length;
  return {sharpeRatio:sharpe,sortinoRatio:sortino,maxDrawdown:maxDD,maxDrawdownPct:maxDD/Math.max(1,Math.abs(cum)),profitFactor:tl>0?tp/tl:tp>0?Infinity:0,kellyGrowthRate:sharpe*sharpe,longestWinStreak:mws,longestLoseStreak:mls,expectedLoseStreak:wp>0?1/wp-1:rows.length,avgProfitPerBet:avgP,profitVariance:variance};
}

export function regimeAnalysis(rows:SettlementRow[]): RegimeResult[] {
  const R:{name:string;f:(r:SettlementRow)=>boolean}[]=[
    {name:'Home Favorite',f:r=>r.side==='home'&&r.odds<2},{name:'Away Favorite',f:r=>r.side==='away'&&r.odds<2},
    {name:'Home Dog',f:r=>r.side==='home'&&r.odds>=2},{name:'Away Dog',f:r=>r.side==='away'&&r.odds>=2},
    {name:'Low Odds <1.5',f:r=>r.odds<1.5},{name:'Med Odds 1.5-2.5',f:r=>r.odds>=1.5&&r.odds<2.5},{name:'High Odds >=2.5',f:r=>r.odds>=2.5},
    {name:'CLV+',f:r=>r.clv>0},{name:'CLV-',f:r=>r.clv<=0},{name:'High EV >10%',f:r=>r.ev>0.1},{name:'Med EV 5-10%',f:r=>r.ev>=0.05&&r.ev<=0.1},
  ];
  return R.map(rg=>{const s=rows.filter(rg.f);const emptyMetrics: MetricsResult = {roi:0,yieldPct:0,winRate:0,totalBets:0,totalProfit:0,totalStake:0,avgEV:0,avgCLV:0,clvPValue:1,ece:0,brierScore:0,logLoss:0};const m=s.length>0?computeMetrics(s):emptyMetrics;return{regime:rg.name,bets:s.length,wins:s.filter(r=>r.isWin).length,roi:m.roi,clv:m.avgCLV,ece:m.ece};});
}

export function leaveOneOut(rows:SettlementRow[], key:(r:SettlementRow)=>string): Array<{group:string;trainMetrics:MetricsResult;testMetrics:MetricsResult}> {
  const groups=[...new Set(rows.map(key))].sort();
  return groups.map(g=>{
    const test=rows.filter(r=>key(r)===g), train=rows.filter(r=>key(r)!==g);
    return{group:g,trainMetrics:computeMetrics(train),testMetrics:computeMetrics(test)};
  });
}

export function stabilitySeeds(compute:(seed:number)=>SettlementRow[], seeds:number[]=Array.from({length:20},(_,i)=>i+1)): RobustnessResult[] {
  const results=seeds.map(s=>computeMetrics(compute(s)));
  const metrics=['roi','avgCLV','ece','brierScore','logLoss']as const;
  return metrics.map(m=>{
    const vals=results.map(r=>r[m]as number), mn=vals.reduce((s,v)=>s+v,0)/vals.length;
    const sd=Math.sqrt(vals.reduce((s,v)=>s+(v-mn)**2,0)/vals.length);
    return{metric:m,mean:mn,stdDev:sd,min:Math.min(...vals),max:Math.max(...vals),stabilityScore:mn!==0?1-sd/Math.abs(mn):0};
  });
}

export function leagueBreakdown(rows:SettlementRow[]): Array<{league:string;metrics:MetricsResult;risk:RiskMetrics;regimes:RegimeResult[]}> {
  const map=new Map<string,SettlementRow[]>();
  for(const r of rows){if(!map.has(r.league))map.set(r.league,[]);map.get(r.league)!.push(r);}
  return Array.from(map.entries()).map(([l,rs])=>({league:l,metrics:computeMetrics(rs),risk:computeRiskMetrics(rs),regimes:regimeAnalysis(rs)})).sort((a,b)=>b.metrics.roi-a.metrics.roi);
}

export function pooledMetrics(leagueResults:Array<{league:string;rows:SettlementRow[]}>): MetricsResult {
  return computeMetrics(leagueResults.flatMap(lr=>lr.rows));
}
