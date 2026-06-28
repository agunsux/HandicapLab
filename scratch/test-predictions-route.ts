import { GET } from '../src/app/api/predictions/route';

async function main() {
  process.env.CRON_SECRET = 'wIxmvaQ4G1AgUFSlrLyVNbZtpBTk25sH';
  
  const req = new Request('http://localhost/api/predictions', {
    headers: {
      'authorization': 'Bearer mock-token'
    }
  });

  console.log('Invoking GET /api/predictions...');
  const res = await GET(req);
  console.log('Status:', res.status);
  
  const body = await res.json();
  console.log('Success:', body.success);
  console.log('Revealed Count:', body.revealedCount);
  console.log('Total predictions in response:', body.predictions?.length);
  
  // Find World Cup matches
  const wcPredictions = body.predictions?.filter((p: any) => p.league === 'WORLD_CUP_KO' || p.league === 'WORLD_CUP_GROUP' || p.match.includes('Brazil') || p.match.includes('Germany'));
  console.log(`\nFound ${wcPredictions?.length} World Cup matches in predictions feed:`);
  
  wcPredictions?.forEach((p: any, idx: number) => {
    console.log(`\n[Feed Item #${idx + 1}] Match: ${p.match} | Kickoff: ${p.kickoff} | League: ${p.league} | Locked: ${p.isLocked}`);
    console.log(`  AH: Line: ${p.asianHandicap?.line} | Odds: ${p.asianHandicap?.odds} | FairOdds: ${p.asianHandicap?.fairOdds} | Edge: ${p.asianHandicap?.edge}%`);
    console.log(`  OU: Line: ${p.overUnder?.line} | Odds: ${p.overUnder?.odds} | FairOdds: ${p.overUnder?.fairOdds} | Edge: ${p.overUnder?.edge}%`);
  });
}

main().catch(console.error);
