import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const key = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY;

async function checkAccount() {
  if (!key) {
    console.error('No OddsPAPI key configured.');
    return;
  }

  // Probe /v4/account with apiKey param or header
  try {
    const res = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${key}`);
    console.log('HTTP Status:', res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error('Response error:', text);
      return;
    }
    const data = await res.json();
    // Print non-sensitive subscription info
    console.log('Account Info:');
    console.log('Language:', data.language_code);
    if (data.subscriptions && Array.isArray(data.subscriptions)) {
      for (const sub of data.subscriptions) {
        console.log('Subscription ID:', sub.subscription_id);
        console.log('Is Active:', sub.is_active);
        console.log('Valid From:', sub.valid_from);
        console.log('Valid Until:', sub.valid_until);
        console.log('Request Limit:', sub.request_limit);
        console.log('Request Count:', sub.request_count);
        console.log('Remaining Quota:', sub.request_limit ? sub.request_limit - sub.request_count : 'unlimited');
        console.log('Bookmakers:', Object.keys(sub.bookmakers || {}));
        console.log('Sport IDs:', sub.sport_ids);
      }
    } else {
      console.log('Raw data structure keys:', Object.keys(data));
    }
  } catch (err: any) {
    console.error('Fetch failed:', err.message);
  }
}

checkAccount();
