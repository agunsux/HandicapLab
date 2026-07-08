// Research Report Generator — JSON + HTML Report Builder
// Location: src/lib/reports/generator.ts

export interface ValidationReportData {
  title: string;
  timestamp: string;
  validationType: 'walkforward' | 'rolling' | 'holdout_season' | 'holdout_league' | 'oos';
  metrics: {
    accuracy: number; logLoss: number; brierScore: number; ece: number;
    roi: number; yield_: number; expectedValue: number; sampleSize: number;
  };
  confidence: { lower95: number; upper95: number };
  passed: boolean;
}

export interface BenchmarkReportData {
  title: string;
  timestamp: string;
  models: Array<{
    name: string;
    roi: number; accuracy: number; logLoss: number; brierScore: number;
    ece: number; expectedValue: number;
  }>;
  ranking: string[];
  datasetSize: number;
}

export interface CalibrationReportData {
  title: string;
  timestamp: string;
  ece: number; mce: number; adaptiveCalibrationError: number;
  buckets: Array<{ range: string; expected: number; actual: number; count: number }>;
  method: 'temperature' | 'platt' | 'isotonic' | 'none';
}

export interface ModelComparisonReportData {
  title: string;
  timestamp: string;
  comparisons: Array<{
    modelA: string; modelB: string;
    metric: string; valueA: number; valueB: number; delta: number;
    significant: boolean; pValue: number;
  }>;
}

export interface InvestorReportData {
  title: string;
  timestamp: string;
  summary: {
    totalBets: number; winRate: number; roi: number;
    sharpeRatio: number; maxDrawdown: number;
    profit: number; stakes: number;
  };
  monthlyBreakdown: Array<{ month: string; bets: number; roi: number; profit: number }>;
  confidenceInterval: { lower: number; upper: number; level: number };
}

export function generateJSONReport(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function generateHTMLReport(data: ValidationReportData | BenchmarkReportData | CalibrationReportData): string {
  const title = data.title || 'Research Report';
  const rows = 'metrics' in data ? Object.entries(data.metrics)
    .filter(([k]) => k !== 'sampleSize')
    .map(([k, v]) => `<tr><td>${k}</td><td>${typeof v === 'number' ? v.toFixed(4) : v}</td></tr>`).join('\n') : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px; }
  h1 { color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 10px; }
  h2 { color: #a5b4fc; margin-top: 30px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { border: 1px solid #334155; padding: 12px; text-align: left; }
  th { background: #1e293b; color: #38bdf8; }
  tr:nth-child(even) { background: #1e293b; }
  .pass { color: #4ade80; font-weight: bold; }
  .fail { color: #f87171; font-weight: bold; }
  .timestamp { color: #94a3b8; font-size: 0.9em; }
</style></head>
<body>
  <h1>${title}</h1>
  <p class="timestamp">Generated: ${data.timestamp || new Date().toISOString()}</p>
  ${'metrics' in data ? `<h2>Performance Metrics</h2><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
  ${'models' in data ? `
  <h2>Model Comparison</h2>
  <table><thead><tr><th>Model</th><th>ROI</th><th>Accuracy</th><th>Log Loss</th><th>Brier</th><th>ECE</th></tr></thead><tbody>
  ${data.models.map((m: any) => `<tr><td>${m.name}</td><td>${(m.roi * 100).toFixed(2)}%</td><td>${(m.accuracy * 100).toFixed(2)}%</td><td>${m.logLoss.toFixed(4)}</td><td>${m.brierScore.toFixed(4)}</td><td>${(m.ece * 100).toFixed(2)}%</td></tr>`).join('')}
  </tbody></table>` : ''}
  ${'buckets' in data ? `
  <h2>Calibration Buckets</h2>
  <table><thead><tr><th>Range</th><th>Expected</th><th>Actual</th><th>Count</th></tr></thead><tbody>
  ${data.buckets.map((b: any) => `<tr><td>${b.range}</td><td>${(b.expected * 100).toFixed(1)}%</td><td>${(b.actual * 100).toFixed(1)}%</td><td>${b.count}</td></tr>`).join('')}
  </tbody></table>` : ''}
  ${'confidence' in data ? `<h2>Confidence Interval</h2><p>95% CI: [${(data.confidence.lower95 * 100).toFixed(2)}%, ${(data.confidence.upper95 * 100).toFixed(2)}%]</p>` : ''}
  ${'passed' in data ? `<h2>Verdict</h2><p class="${data.passed ? 'pass' : 'fail'}">${data.passed ? 'PASSED' : 'FAILED'}</p>` : ''}
</body></html>`;
}
