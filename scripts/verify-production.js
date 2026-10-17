// scripts/verify-production.js
// Verification suite for Cloud Run Backend + Vercel Hobby Frontend Decoupling

async function verify() {
  console.log('===============================================================');
  console.log('   PRODUCTION VERIFICATION: VERCEL HOBBY + CLOUD RUN BACKEND   ');
  console.log('===============================================================\n');

  const tests = [
    { name: 'Vercel Frontend: Homepage (handicaplab.dev)', url: 'https://handicaplab.dev/' },
    { name: 'Vercel Frontend: Models Registry', url: 'https://handicaplab.dev/models' },
    { name: 'Vercel Frontend: Daily Picks UI', url: 'https://handicaplab.dev/daily-picks' },
    { name: 'Vercel Frontend: Track Record', url: 'https://handicaplab.dev/track-record' },
    { name: 'Vercel Edge Rewrite -> Cloud Run: Health Check', url: 'https://handicaplab.dev/api/v1/health' },
    { name: 'Vercel Edge Rewrite -> Cloud Run: Public Predictions', url: 'https://handicaplab.dev/api/public/predictions' },
    { name: 'Cloud Run Direct: Health Check', url: 'https://handicaplab-production-129269713730.asia-southeast2.run.app/api/v1/health' },
    { name: 'Cloud Run Direct: Public Predictions', url: 'https://handicaplab-production-129269713730.asia-southeast2.run.app/api/public/predictions' },
    { name: 'SALMO Production: Homepage', url: 'https://salmo.dev/' },
    { name: 'SALMO Production: Daily Picks Page', url: 'https://salmo.dev/daily-picks' },
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      const res = await fetch(t.url, {
        headers: { 'User-Agent': 'HandicapLab-Production-Verification/1.0' },
      });
      const ct = (res.headers.get('content-type') || '').split(';')[0];
      const isOk = res.status >= 200 && res.status < 400;

      if (isOk) {
        console.log(`[PASS] ${t.name}`);
        console.log(`       URL: ${t.url}`);
        console.log(`       Status: HTTP ${res.status} | Content-Type: ${ct}`);
        passed++;

        if (t.url.includes('/api/public/predictions')) {
          const json = await res.json();
          const list = json.predictions || json.data || [];
          console.log(`       Payload: ${list.length} real predictions returned`);
          if (list.length > 0) {
            const first = list[0];
            console.log(`       Sample: ${first.home_team || first.homeTeam} vs ${first.away_team || first.awayTeam} (Market: ${first.side || first.market})`);
          }
        } else if (t.url.includes('/api/v1/health')) {
          const json = await res.json();
          console.log(`       Payload: status=${json.data?.status || json.status || 'OK'}`);
        }
      } else {
        console.error(`[FAIL] ${t.name}`);
        console.error(`       URL: ${t.url}`);
        console.error(`       Status: HTTP ${res.status}`);
        failed++;
      }
    } catch (err) {
      console.error(`[FAIL] ${t.name}`);
      console.error(`       URL: ${t.url}`);
      console.error(`       Error: ${err.message}`);
      failed++;
    }
    console.log('');
  }

  console.log('===============================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');
}

verify();
