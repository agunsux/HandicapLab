import { GET } from '../app/api/predictions/route';

async function verifyAPI() {
  console.log("=== ENFORCING STAGE D: SERVER-SIDE FREEMIUM BOUNDARY ===");
  
  const req = new Request('http://localhost:3000/api/predictions?limit=5');
  const res = await GET(req);
  const json = await res.json();
  
  const predictions = json.predictions;
  
  if (!predictions) {
    console.error("FAILED to parse predictions:", json);
    return;
  }
  
  console.log(`\n[FREE USER] Opportunities fetched: ${predictions.length}`);
  
  const freeLocked = predictions.filter((p: any) => p.isLocked);
  const freeUnlocked = predictions.filter((p: any) => !p.isLocked);
  
  console.log(`- Unlocked rows (under daily limit): ${freeUnlocked.length}`);
  console.log(`- Locked rows (over daily limit): ${freeLocked.length}`);
  
  if (freeLocked.length > 0) {
    const sampleLocked = freeLocked[0];
    console.log("\n[FREE USER] Sample LOCKED row prediction object:", sampleLocked.prediction);
    console.log("Security Check: Premium fields (home/draw/away) must be null.");
    const isLeaked = sampleLocked.prediction.home !== null || sampleLocked.prediction.draw !== null || sampleLocked.prediction.away !== null;
    console.log(`Security Check (Locked Row): ${isLeaked ? "FAILED ❌ (Premium data leaked)" : "PASSED ✅ (No premium data present)"}`);
  }
}

verifyAPI();
