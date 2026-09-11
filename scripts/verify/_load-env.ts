// Loads .env.local then .env (non-overriding) BEFORE any module that reads
// process.env at import time (e.g. the provider config). Import this module
// first in verification/ingestion scripts.
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });
