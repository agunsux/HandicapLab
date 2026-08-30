// POST-VAR OVER/UNDER 3.0 EMPIRICAL STUDY SCRIPT
// Location: scripts/scratch/post-var-ou3-empirical-study.ts

import * as fs from 'fs';
import * as path from 'path';

interface CanonicalMatch {
  canonicalId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  totalGoals: number;
  result: string;
  odds?: {
    ouLine?: number;
    over?: number;
    under?: number;
    bookmakerSource?: string;
    [key: string]: any;
  };
}

interface GoalDist {
  g0: number;
  g1: number;
  g2: number;
  g3: number;
  g4: number;
  g5: number;
  g6plus: number;
  totalMatches: number;
  underWins: number; // goals <= 2
  pushes: number;    // goals == 3
  overWins: number;  // goals >= 4
  pUnder: number;    // underWins / totalMatches
  pPush: number;     // pushes / totalMatches
  pOver: number;     // overWins / totalMatches
  avgGoals: number;
}

function computeGoalDistribution(matches: CanonicalMatch[]): GoalDist {
  let g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6plus = 0;
  let totalGoalsSum = 0;

  for (const m of matches) {
    const tg = m.totalGoals;
    totalGoalsSum += tg;
    if (tg === 0) g0++;
    else if (tg === 1) g1++;
    else if (tg === 2) g2++;
    else if (tg === 3) g3++;
    else if (tg === 4) g4++;
    else if (tg === 5) g5++;
    else g6plus++;
  }

  const n = matches.length;
  const underWins = g0 + g1 + g2;
  const pushes = g3;
  const overWins = g4 + g5 + g6plus;

  return {
    g0,
    g1,
    g2,
    g3,
    g4,
    g5,
    g6plus,
    totalMatches: n,
    underWins,
    pushes,
    overWins,
    pUnder: n > 0 ? Number(((underWins / n) * 100).toFixed(2)) : 0,
    pPush: n > 0 ? Number(((pushes / n) * 100).toFixed(2)) : 0,
    pOver: n > 0 ? Number(((overWins / n) * 100).toFixed(2)) : 0,
    avgGoals: n > 0 ? Number((totalGoalsSum / n).toFixed(3)) : 0,
  };
}

function runStudy() {
  const filePath = path.resolve(process.cwd(), 'data', 'golden', 'europe', 'canonical_matches.jsonl');
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');

  const allEplMatches: CanonicalMatch[] = [];
  let ou3MatchesCount = 0;

  for (const line of lines) {
    if (!line) continue;
    const m: CanonicalMatch = JSON.parse(line);
    if (m.leagueId === 'ENG-PL' && m.homeGoals >= 0 && m.awayGoals >= 0) {
      allEplMatches.push(m);
      if (m.odds && typeof m.odds.ouLine === 'number' && Math.abs(m.odds.ouLine - 3.0) < 0.001) {
        ou3MatchesCount++;
      }
    }
  }

  const postVarSeasons = [
    '2019-2020',
    '2020-2021',
    '2021-2022',
    '2022-2023',
    '2023-2024',
    '2024-2025',
    '2025-2026',
  ];

  const preVarSeasons = [
    '2015-2016',
    '2016-2017',
    '2017-2018',
    '2018-2019',
  ];

  const postVarMatches = allEplMatches.filter((m) => postVarSeasons.includes(m.season));
  const preVarMatches = allEplMatches.filter((m) => preVarSeasons.includes(m.season));
  const recent3Matches = allEplMatches.filter((m) => ['2023-2024', '2024-2025', '2025-2026'].includes(m.season));
  const s2526Matches = allEplMatches.filter((m) => m.season === '2025-2026');

  console.log('========================================================');
  console.log('HANDICAPLAB POST-VAR O/U 3.0 EMPIRICAL STUDY');
  console.log('========================================================\n');

  console.log('DATASET INVENTORY:');
  console.log(`Total EPL Matches Scanned:        ${allEplMatches.length}`);
  console.log(`Post-VAR Matches (2019-2026):     ${postVarMatches.length} (${postVarSeasons.length} seasons)`);
  console.log(`Pre-VAR Matches (2015-2019):      ${preVarMatches.length} (${preVarSeasons.length} seasons)`);
  console.log(`Qualifying Matches with ouLine=3.0: ${ou3MatchesCount}\n`);

  console.log('--- GOAL DISTRIBUTION: FULL POST-VAR (2019-2026) ---');
  const postDist = computeGoalDistribution(postVarMatches);
  console.log(JSON.stringify(postDist, null, 2));

  console.log('\n--- GOAL DISTRIBUTION: PRE-VAR (2015-2019) ---');
  const preDist = computeGoalDistribution(preVarMatches);
  console.log(JSON.stringify(preDist, null, 2));

  console.log('\n--- GOAL DISTRIBUTION: RECENT 3 SEASONS (2023-2026) ---');
  const r3Dist = computeGoalDistribution(recent3Matches);
  console.log(JSON.stringify(r3Dist, null, 2));

  console.log('\n--- GOAL DISTRIBUTION: LATEST SEASON (2025-2026) ---');
  const s2526Dist = computeGoalDistribution(s2526Matches);
  console.log(JSON.stringify(s2526Dist, null, 2));

  console.log('\n--- SEASON-BY-SEASON GOAL DISTRIBUTION ---');
  for (const s of [...preVarSeasons, ...postVarSeasons]) {
    const sMatches = allEplMatches.filter((m) => m.season === s);
    const d = computeGoalDistribution(sMatches);
    console.log(
      `${s.padEnd(12)} Matches: ${d.totalMatches} | <=2 Goals: ${String(d.underWins).padStart(3)} (${d.pUnder}%) | =3 Goals: ${String(d.pushes).padStart(3)} (${d.pPush}%) | >=4 Goals: ${String(d.overWins).padStart(3)} (${d.pOver}%) | Avg Goals: ${d.avgGoals}`
    );
  }
}

runStudy();
