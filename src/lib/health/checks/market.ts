// Market Intelligence Dependency Health Check (Lightweight Metadata)
// Location: src/lib/health/checks/market.ts

import { HealthCheck, HealthCheckResult } from '../types';

export class MarketCheck implements HealthCheck {
  public name = 'market';

  public async run(): Promise<Omit<HealthCheckResult, 'latency_ms' | 'timestamp'>> {
    try {
      const fs = eval("require('fs')").promises;
      const path = eval("require('path')");
      
      const artifactDir = 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\b0e51ad4-db7e-4196-9e0e-e58ff37caeeb\\artifacts';
      const filePath = path.join(artifactDir, 'market_snapshots.json');
      
      let exists = false;
      let lastModified: string | null = null;
      
      try {
        const stats = await fs.stat(filePath);
        exists = true;
        lastModified = stats.mtime.toISOString();
      } catch {
        exists = false;
      }
      
      if (!exists) {
        return {
          status: 'unhealthy',
          message: 'Market snapshot files are unavailable on disk.'
        };
      }
      
      return {
        status: 'healthy',
        details: {
          lastModified
        }
      };
    } catch (err: any) {
      return {
        status: 'unhealthy',
        message: err.message || String(err)
      };
    }
  }
}
