const fs=require("fs"),path=require("path");
const d="src/pipelines";
function w(f,c){const p=path.join(d,f);const dir=path.dirname(p);if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(p,c.trim()+"\n","utf8");console.log(p);}
w("types.ts","export interface UnderstatFixture{fixtureId:string;fixtureNaturalKey:string;competitionId:string;seasonId:string;homeTeamId:string;awayTeamId:string;homeGoals:{value:number;source:string;confidence:number;mergeReason:string};awayGoals:{value:number;source:string;confidence:number;mergeReason:string};homeXg:{value:number;source:string;confidence:number;mergeReason:string};awayXg:{value:number;source:string;confidence:number;mergeReason:string};datetime?:string;}");
console.log("types check");
