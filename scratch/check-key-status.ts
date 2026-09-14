import 'dotenv/config';

// SECURITY: this diagnostic must NEVER print the API key (or any part of it).
// It also must only ever talk to the official api-sports host. A second host
// (e.g. RapidAPI) is a separate API-Football access channel and is forbidden by
// the single-account compliance policy.

async function main() {
  const apiKey = process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY;
  console.log(`API-Football key present: ${Boolean(apiKey)}`);

  if (!apiKey) {
    console.log('No API-Football key configured. Nothing to probe.');
    return;
  }

  const url = 'https://v3.football.api-sports.io/status';

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
        'Accept': 'application/json',
      },
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const data: any = await res.json();
    const accountActive = data?.response?.account?.active;
    const subscription = data?.response?.subscription;
    console.log(`Account active: ${accountActive}`);
    if (subscription) {
      console.log(`Subscription plan: ${subscription.plan ?? 'unknown'} (ends ${subscription.end ?? 'n/a'})`);
    }
    if (data?.errors && Object.keys(data.errors).length > 0) {
      console.log(`Provider errors: ${JSON.stringify(data.errors)}`);
    }
  } catch (e: any) {
    console.error(`Probe failed: ${e?.message || e}`);
  }
}

main();
