import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

async function runDiagnostic() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase URL or Service Key.');
    return;
  }

  console.log(`Fetching OpenAPI spec from: ${supabaseUrl}/rest/v1/`);
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    if (!response.ok) {
      console.error(`Failed to fetch OpenAPI spec. HTTP ${response.status}`);
      return;
    }

    const spec = await response.json();
    console.log('\n--- RPC DIAGNOSTIC RESULTS ---\n');

    const rpcsToCheck = [
      'reserve_quota',
      'confirm_quota',
      'rollback_quota',
      'cleanup_stale_reservations'
    ];

    for (const rpc of rpcsToCheck) {
      const pathKey = `/rpc/${rpc}`;
      if (spec.paths && spec.paths[pathKey]) {
        console.log(`[PRESENT] ${rpc}`);
        const postDef = spec.paths[pathKey].post;
        if (postDef && postDef.parameters) {
          const bodyParam = postDef.parameters.find((p: any) => p.in === 'body');
          if (bodyParam && bodyParam.schema && bodyParam.schema.properties) {
            console.log(`  Signature in Production:`);
            for (const [argName, argDef] of Object.entries(bodyParam.schema.properties)) {
              console.log(`    - ${argName}: ${(argDef as any).type} ${(argDef as any).format ? '(' + (argDef as any).format + ')' : ''}`);
            }
          } else {
             console.log(`  Signature in Production: No parameters required (or unparseable schema)`);
          }
        }
      } else {
        console.log(`[MISSING] ${rpc}`);
      }
      console.log('---------------------------------');
    }

  } catch (err: any) {
    console.error('Error fetching/parsing OpenAPI spec:', err.message);
  }
}

runDiagnostic();
