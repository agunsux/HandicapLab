async function main() {
  process.env.API_FOOTBALL_KEY = 'mock'; // Force mock mode
  process.env.CRON_SECRET = 'wIxmvaQ4G1AgUFSlrLyVNbZtpBTk25sH';

  const { GET: IngestGET } = await import('../app/api/cron/ingest/route');
  const { GET: PredictGET } = await import('../app/api/cron/predict/route');

  const req = new Request('http://localhost/api/cron', {
    headers: { 'authorization': `Bearer ${process.env.CRON_SECRET}` }
  });
  
  console.log('--- Running Local Ingest (Mock Mode) to Prod DB ---');
  const resIngest = await IngestGET(req);
  console.log('Ingest Response Status:', resIngest.status);
  console.log('Ingest Response:', await resIngest.text());
  
  console.log('--- Running Local Predict to Prod DB ---');
  const resPredict = await PredictGET(req);
  console.log('Predict Response Status:', resPredict.status);
  console.log('Predict Response:', await resPredict.text());
}

main();
