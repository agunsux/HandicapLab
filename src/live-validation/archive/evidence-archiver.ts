// EPIC 35.13 — Scientific Evidence Archive
// Packages daily, weekly, and monthly immutable evidence snapshots into
// filesystem archives under data/validation/YYYY/MM/DD/ with cryptographic
// SHA-256 manifests for empirical verification.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { LiveValidationStore } from '../store/types';
import { renderReportMarkdown } from '../reports/weekly-report';

export interface EvidenceManifest {
  manifestVersion: string;
  archiveDate: string;
  generatedAt: string;
  predictionsCount: number;
  settlementsCount: number;
  files: Array<{
    fileName: string;
    sha256: string;
    sizeBytes: number;
  }>;
  summary: {
    roi: number;
    clv: number | null;
    brierScore: number | null;
    ece: number | null;
  };
}

export function sha256Buffer(buffer: Buffer | string): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export class ScientificEvidenceArchiver {
  private baseDir: string;

  constructor(
    private store: LiveValidationStore,
    projectRoot?: string
  ) {
    const root = projectRoot || process.cwd();
    this.baseDir = path.join(root, 'data', 'validation');
  }

  /** Package and export daily evidence archive for target ISO date (YYYY-MM-DD) */
  async exportDailyArchive(targetDateISO?: string): Promise<{
    archivePath: string;
    manifest: EvidenceManifest;
  }> {
    const target = targetDateISO || new Date().toISOString().slice(0, 10);
    const [year, month, day] = target.split('-');

    const dayDir = path.join(this.baseDir, year, month, day);
    if (!fs.existsSync(dayDir)) {
      fs.mkdirSync(dayDir, { recursive: true });
    }

    const from = `${target}T00:00:00.000Z`;
    const to = `${target}T23:59:59.999Z`;

    const predictions = await this.store.listPredictions({ from, to });
    const settlements = await this.store.listSettlements({ from, to });
    const latestMetrics = await this.store.getLatestRollingMetrics(30);
    const latestCalibration = await this.store.getLatestCalibration();

    // 1. Write predictions.json
    const predictionsFile = path.join(dayDir, 'predictions.json');
    const predictionsContent = JSON.stringify(predictions, null, 2);
    fs.writeFileSync(predictionsFile, predictionsContent, 'utf-8');

    // 2. Write settlements.json
    const settlementsFile = path.join(dayDir, 'settlements.json');
    const settlementsContent = JSON.stringify(settlements, null, 2);
    fs.writeFileSync(settlementsFile, settlementsContent, 'utf-8');

    // 3. Write daily_report.md
    const totalProfit = settlements.reduce((a, s) => a + s.profit, 0);
    const totalStaked = settlements.reduce((a, s) => a + s.stake, 0);
    const roi = totalStaked > 0 ? totalProfit / totalStaked : 0;
    const wins = settlements.filter(s => s.outcome === 'win' || s.outcome === 'half_win').length;
    const hitRate = settlements.length > 0 ? wins / settlements.length : 0;

    const reportMd = [
      `# DAILY LIVE VALIDATION REPORT — ${target}`,
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Predictions Created:** ${predictions.length}`,
      `**Settlements Executed:** ${settlements.length}`,
      `**Daily ROI:** ${(roi * 100).toFixed(2)}%`,
      `**Daily Hit Rate:** ${(hitRate * 100).toFixed(1)}%`,
      `**Daily Profit:** ${totalProfit.toFixed(2)} units`,
      '',
      '## Fixtures Summary',
      ...predictions.map(
        p => `- [${p.model.predictionTimestamp.slice(11, 16)}] ${p.fixture.homeTeam} vs ${p.fixture.awayTeam} (${p.fixture.league}) — EV: +${(p.prediction.expectedValue * 100).toFixed(1)}%`
      ),
    ].join('\n');

    const reportFile = path.join(dayDir, 'daily_report.md');
    fs.writeFileSync(reportFile, reportMd, 'utf-8');

    // 4. Create evidence_manifest.json
    const fileEntries = [
      {
        fileName: 'predictions.json',
        sha256: sha256Buffer(predictionsContent),
        sizeBytes: Buffer.byteLength(predictionsContent),
      },
      {
        fileName: 'settlements.json',
        sha256: sha256Buffer(settlementsContent),
        sizeBytes: Buffer.byteLength(settlementsContent),
      },
      {
        fileName: 'daily_report.md',
        sha256: sha256Buffer(reportMd),
        sizeBytes: Buffer.byteLength(reportMd),
      },
    ];

    const manifest: EvidenceManifest = {
      manifestVersion: '1.0',
      archiveDate: target,
      generatedAt: new Date().toISOString(),
      predictionsCount: predictions.length,
      settlementsCount: settlements.length,
      files: fileEntries,
      summary: {
        roi: Number(roi.toFixed(4)),
        clv: latestMetrics?.avgClv ?? null,
        brierScore: latestMetrics?.brierScore ?? null,
        ece: latestCalibration?.ece ?? null,
      },
    };

    const manifestFile = path.join(dayDir, 'evidence_manifest.json');
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf-8');

    return {
      archivePath: dayDir,
      manifest,
    };
  }

  /** List available archived dates */
  listArchives(): string[] {
    if (!fs.existsSync(this.baseDir)) return [];
    const archives: string[] = [];

    const years = fs.readdirSync(this.baseDir).filter(y => /^\d{4}$/.test(y));
    for (const y of years) {
      const months = fs.readdirSync(path.join(this.baseDir, y)).filter(m => /^\d{2}$/.test(m));
      for (const m of months) {
        const days = fs.readdirSync(path.join(this.baseDir, y, m)).filter(d => /^\d{2}$/.test(d));
        for (const d of days) {
          archives.push(`${y}-${m}-${d}`);
        }
      }
    }

    return archives.sort().reverse();
  }
}
