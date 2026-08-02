import { getProviderHealth } from '@/lib/providers/quotaManager';
import React from 'react';

export const dynamic = 'force-dynamic';

export default async function AdminSystemPage() {
  const healthData = await getProviderHealth();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">System Health & API Usage</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {healthData.map((provider) => (
          <div key={provider.provider} className="p-6 border rounded-lg shadow-sm bg-white">
            <h2 className="text-xl font-semibold capitalize mb-4">{provider.provider}</h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${provider.healthy ? 'text-green-600' : 'text-red-600'}`}>
                  {provider.healthy ? 'HEALTHY' : 'DEGRADED'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500">Mode</span>
                <span className={`font-medium ${
                  provider.mode === 'CRITICAL' ? 'text-red-600' : 
                  provider.mode === 'ECONOMY' ? 'text-amber-500' : 'text-green-600'
                }`}>
                  {provider.mode}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Quota Used</span>
                <span className="font-mono">
                  {provider.quotaUsed} / {provider.quotaLimit} ({provider.quotaPct}%)
                </span>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className={`h-2 rounded-full ${
                    provider.quotaPct > 90 ? 'bg-red-500' : 
                    provider.quotaPct > 75 ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, provider.quotaPct)}%` }}
                ></div>
              </div>

              <div className="flex justify-between pt-2 border-t mt-2">
                <span className="text-gray-500">Avg Latency</span>
                <span>{provider.avgLatencyMs} ms</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500">Success Rate</span>
                <span>{provider.successRate}%</span>
              </div>

            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Pipeline Cron Schedule</h2>
        <ul className="space-y-2 text-sm font-mono text-gray-700">
          <li>00:10 UTC - Discovery (TheStatsAPI)</li>
          <li>00:20 UTC - Odds Ingestion (OddsPAPI)</li>
          <li>*/30 * * * * - Targeted Enrichment (API-Football)</li>
          <li>0 */2 * * * - Settlement & Metrics Calculation</li>
        </ul>
      </div>
    </div>
  );
}
