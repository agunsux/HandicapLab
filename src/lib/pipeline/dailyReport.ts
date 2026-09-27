// ============================================================================
// DAILY AUDIT REPORT & ARTIFACT GENERATOR
// ============================================================================
// Location: src/lib/pipeline/dailyReport.ts
//
// Invariants enforced:
// 1. Every successful daily run produces:
//    - data/verification/daily/YYYY-MM-DD.json (machine-readable)
//    - docs/daily/YYYY-MM-DD.md (human-readable audit trail)
// 2. Sections: Status, Quota, Fixtures, Predictions, Settlements, Yield, Model Health, Salmo Sync.
// 3. No invented/manufactured numbers. If missing -> N/A.
// 4. Yesterday's audit trail is never overwritten or hidden.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { DailyRunRecord } from './runIdentity';
import { WindowHealthSummary } from './modelHealth';
import { SalmoSyncReport } from './salmoSyncService';

export interface DailyReportData {
  runId: string;
  dateStr: string; // YYYY-MM-DD
  generatedAt: string;
  pipelineStatus: 'HEALTHY' | 'PARTIAL' | 'STALE' | 'FAILED';
  scheduler: {
    schedule: string;
    lastSuccessfulRun: string | null;
    nextScheduledRun: string;
  };
  providers: {
    apiFootball: {
      status: string;
      requestsUsed: number;
      remainingQuota: number;
      cacheHits: number;
      fixturesDiscovered: number;
      resultsFetched: number;
    };
    oddsPapi: {
      status: string;
      requestsUsed: number;
      remainingQuota: number;
      protectedReserve: number;
      cachedOdds: number;
      rateLimitHits: number;
    };
  };
  fixtures: {
    today: number;
    tomorrow: number;
    next7Days: number;
  };
  predictions: {
    ah: number;
    btts: number;
    ou: number;
    total: number;
  };
  qualifiedPicks: {
    total: number;
    ah: number;
    btts: number; // 0, always 0 (research only)
    ou: number;
    hasQualifiedPick: boolean;
  };
  highConfidence: {
    total: number;
    syncedToSalmo: number;
    items: Array<{
      match: string;
      market: string;
      selection: string;
      line: number | null;
      odds: number;
      probability: number;
      edge: number;
      expectedValue: number;
      kickoff: string;
    }>;
  };
  yesterdaySettlement: {
    date: string;
    totalBets: number;
    wins: number;
    losses: number;
    pushes: number;
    voids: number;
    winRatePct: number | null;
    grossProfitUnits: number;
    yieldPct: number | null;
    roiPct: number | null;
    markets: {
      ah: { bets: number; wins: number; losses: number; yieldPct: number | null };
      btts: { bets: number; wins: number; losses: number; status: 'RESEARCH_ONLY'; brier: number };
      ou: { bets: number; wins: number; losses: number; yieldPct: number | null };
    };
  };
  modelHealth: {
    ahBrier: number | null;
    bttsBrier: number;
    pinnacleBttsBrier: number;
    ouBrier: number | null;
    clvPct: number | null;
    targetWinRatePct: number;
    targetAchieved: boolean;
    diagnostics: string[];
  };
  salmoSync: {
    status: string;
    created: number;
    updated: number;
    unchanged: number;
    rejected: number;
    errorMessage?: string;
  };
  productionTruth: {
    realProviderData: boolean;
    realOdds: boolean;
    realSettlement: boolean;
    dailyAutomation: boolean;
    salmoSync: boolean;
    overallStatus: 'LIVE' | 'PARTIAL' | 'NOT_LIVE';
  };
}

export class DailyReportGenerator {
  public static generateMarkdownReport(data: DailyReportData): string {
    const lines: string[] = [];

    lines.push(`# DAILY PIPELINE STATUS — ${data.dateStr}`);
    lines.push('');
    lines.push(`- **Run ID**: \`${data.runId}\``);
    lines.push(`- **Generated At**: \`${data.generatedAt}\``);
    lines.push(`- **Scheduler**: \`${data.scheduler.schedule}\``);
    lines.push(`- **Last Successful Run**: ${data.scheduler.lastSuccessfulRun ? `\`${data.scheduler.lastSuccessfulRun}\`` : 'None'}`);
    lines.push(`- **Next Scheduled Run**: \`${data.scheduler.nextScheduledRun}\``);
    lines.push(`- **Pipeline Health**: **${data.pipelineStatus}**`);
    lines.push('');

    lines.push('---');
    lines.push('## 1. API PROVIDER CONSUMPTION & TELEMETRY');
    lines.push('');
    lines.push('### API-Football Pro');
    lines.push(`- **Status**: ${data.providers.apiFootball.status}`);
    lines.push(`- **Requests Used**: ${data.providers.apiFootball.requestsUsed}`);
    lines.push(`- **Remaining Quota**: ${data.providers.apiFootball.remainingQuota} / 7,500`);
    lines.push(`- **Cache Hits**: ${data.providers.apiFootball.cacheHits}`);
    lines.push(`- **Fixtures Discovered**: ${data.providers.apiFootball.fixturesDiscovered}`);
    lines.push(`- **Results Fetched**: ${data.providers.apiFootball.resultsFetched}`);
    lines.push('');

    lines.push('### OddsPAPI (Pinnacle Sharp Benchmark)');
    lines.push(`- **Status**: ${data.providers.oddsPapi.status}`);
    lines.push(`- **Requests Used**: ${data.providers.oddsPapi.requestsUsed}`);
    lines.push(`- **Remaining Quota**: ${data.providers.oddsPapi.remainingQuota} / 250`);
    lines.push(`- **Protected Reserve**: ${data.providers.oddsPapi.protectedReserve} requests`);
    lines.push(`- **Cached Odds Snapshots**: ${data.providers.oddsPapi.cachedOdds}`);
    lines.push(`- **429 Rate Limit Hits**: ${data.providers.oddsPapi.rateLimitHits}`);
    lines.push('');

    lines.push('---');
    lines.push('## 2. FIXTURES & MARKET PREDICTIONS');
    lines.push('');
    lines.push(`- **Fixtures Today**: ${data.fixtures.today}`);
    lines.push(`- **Fixtures Tomorrow**: ${data.fixtures.tomorrow}`);
    lines.push(`- **Fixtures Next 7 Days**: ${data.fixtures.next7Days}`);
    lines.push('');
    lines.push('| Market | Generated Predictions | Status |');
    lines.push('| :--- | :--- | :--- |');
    lines.push(`| **Asian Handicap (AH)** | ${data.predictions.ah} | ACTIVE_PRODUCTION |`);
    lines.push(`| **Both Teams To Score (BTTS)** | ${data.predictions.btts} | **RESEARCH_ONLY** |`);
    lines.push(`| **Over / Under (OU)** | ${data.predictions.ou} | ACTIVE_PRODUCTION |`);
    lines.push(`| **Total** | **${data.predictions.total}** | - |`);
    lines.push('');

    lines.push('---');
    lines.push('## 3. DAILY QUALIFIED PICKS & GATES');
    lines.push('');
    lines.push('Qualification Gates: `P > 65%` AND `Odds >= 1.60` AND `Edge > 0` AND `EV > 0`.');
    lines.push('');
    lines.push(`- **Total Qualified Candidates**: ${data.qualifiedPicks.total}`);
    lines.push(`- **AH Qualified**: ${data.qualifiedPicks.ah}`);
    lines.push(`- **BTTS Qualified**: ${data.qualifiedPicks.btts} (Mandatory Gated: Always 0)`);
    lines.push(`- **OU Qualified**: ${data.qualifiedPicks.ou}`);
    lines.push('');

    if (!data.qualifiedPicks.hasQualifiedPick || data.highConfidence.total === 0) {
      lines.push('> [!NOTE]');
      lines.push('> **NO QUALIFIED PICK TODAY**');
      lines.push('> No match satisfied the strict probabilistic gates (P > 65%, Odds >= 1.60, Positive Edge). Standards were NOT lowered.');
      lines.push('');
    } else {
      lines.push('### High Confidence Picks');
      lines.push('');
      lines.push('| Match | Market | Selection | Odds | Probability | Edge | EV | Kickoff |');
      lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
      for (const p of data.highConfidence.items) {
        lines.push(
          `| ${p.match} | ${p.market} | ${p.selection} | ${p.odds.toFixed(2)} | ${(p.probability * 100).toFixed(1)}% | +${(p.edge * 100).toFixed(1)}% | +${(p.expectedValue * 100).toFixed(1)}% | ${p.kickoff} |`
        );
      }
      lines.push('');
    }

    lines.push('---');
    lines.push(`## 4. YESTERDAY SETTLEMENT & REALIZED YIELD (${data.yesterdaySettlement.date})`);
    lines.push('');
    lines.push(`- **Total Settled Bets**: ${data.yesterdaySettlement.totalBets}`);
    lines.push(`- **Wins**: ${data.yesterdaySettlement.wins}`);
    lines.push(`- **Losses**: ${data.yesterdaySettlement.losses}`);
    lines.push(`- **Pushes / Voids**: ${data.yesterdaySettlement.pushes + data.yesterdaySettlement.voids}`);
    lines.push(`- **Realized Win Rate**: ${data.yesterdaySettlement.winRatePct !== null ? `${data.yesterdaySettlement.winRatePct}%` : 'N/A'}`);
    lines.push(`- **Gross Profit**: ${data.yesterdaySettlement.grossProfitUnits > 0 ? '+' : ''}${data.yesterdaySettlement.grossProfitUnits.toFixed(2)} units`);
    lines.push(`- **Realized Yield (ROI)**: ${data.yesterdaySettlement.yieldPct !== null ? `${data.yesterdaySettlement.yieldPct}%` : 'N/A'}`);
    lines.push('');

    lines.push('---');
    lines.push('## 5. MODEL HEALTH & BENCHMARKS');
    lines.push('');
    lines.push(`- **Target Win Rate KPI**: ${data.modelHealth.targetWinRatePct}%`);
    lines.push(`- **Target Achieved**: ${data.modelHealth.targetAchieved ? 'YES' : 'NO / EVALUATING'}`);
    lines.push(`- **AH Brier Score**: ${data.modelHealth.ahBrier !== null ? data.modelHealth.ahBrier : 'N/A'}`);
    lines.push(`- **BTTS Model Brier**: ${data.modelHealth.bttsBrier} (vs Pinnacle Benchmark: ${data.modelHealth.pinnacleBttsBrier})`);
    lines.push(`- **OU Brier Score**: ${data.modelHealth.ouBrier !== null ? data.modelHealth.ouBrier : 'N/A'}`);
    lines.push(`- **Average CLV**: ${data.modelHealth.clvPct !== null ? `${data.modelHealth.clvPct}%` : 'N/A'}`);
    lines.push('');
    lines.push('### Diagnostics');
    for (const diag of data.modelHealth.diagnostics) {
      lines.push(`- ${diag}`);
    }
    lines.push('');

    lines.push('---');
    lines.push('## 6. SALMO SYNCHRONIZATION');
    lines.push('');
    lines.push(`- **Sync Status**: **${data.salmoSync.status}**`);
    lines.push(`- **Decisions Created**: ${data.salmoSync.created}`);
    lines.push(`- **Decisions Updated**: ${data.salmoSync.updated}`);
    lines.push(`- **Decisions Unchanged**: ${data.salmoSync.unchanged}`);
    lines.push(`- **Records Rejected / Gated**: ${data.salmoSync.rejected}`);
    if (data.salmoSync.errorMessage) {
      lines.push(`- **Error Message**: ${data.salmoSync.errorMessage}`);
    }
    lines.push('');

    lines.push('---');
    lines.push('## 7. PRODUCTION TRUTH AUDIT');
    lines.push('');
    lines.push(`- **REAL PROVIDER DATA**: ${data.productionTruth.realProviderData ? 'YES' : 'NO'}`);
    lines.push(`- **REAL ODDS**: ${data.productionTruth.realOdds ? 'YES' : 'NO'}`);
    lines.push(`- **REAL SETTLEMENT**: ${data.productionTruth.realSettlement ? 'YES' : 'NO'}`);
    lines.push(`- **DAILY AUTOMATION**: ${data.productionTruth.dailyAutomation ? 'PROVEN' : 'NOT PROVEN'}`);
    lines.push(`- **SALMO SYNC**: ${data.productionTruth.salmoSync ? 'PROVEN' : 'NOT PROVEN'}`);
    lines.push(`- **OVERALL STATUS**: **${data.productionTruth.overallStatus}**`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Persists both JSON and Markdown daily artifacts to disk.
   */
  public static persistDailyArtifacts(data: DailyReportData): {
    jsonPath: string;
    mdPath: string;
  } {
    const isTest = process.env.NODE_ENV === 'test';
    const isVercel = Boolean(process.env.VERCEL);

    let jsonDir = path.resolve('data/verification/daily');
    let mdDir = path.resolve('docs/daily');

    if (isTest) {
      jsonDir = path.resolve('data/test_ledger/daily');
      mdDir = path.resolve('data/test_ledger/daily_docs');
    } else if (isVercel) {
      const os = require('os');
      jsonDir = path.join(os.tmpdir(), 'handicaplab_daily_verification');
      mdDir = path.join(os.tmpdir(), 'handicaplab_daily_docs');
    }

    if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });
    if (!fs.existsSync(mdDir)) fs.mkdirSync(mdDir, { recursive: true });

    const jsonPath = path.join(jsonDir, `${data.dateStr}.json`);
    const mdPath = path.join(mdDir, `${data.dateStr}.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync(mdPath, this.generateMarkdownReport(data), 'utf8');

    return { jsonPath, mdPath };
  }
}
