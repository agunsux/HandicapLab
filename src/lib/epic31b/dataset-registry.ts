import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface DatasetMetadata {
  provider: string;
  league: string;
  season: string;
  filePath: string;
  rowsCount: number;
  columnsAvailable: string[];
  openingOddsCompleteness: number; // percentage (0 - 100)
  closingOddsCompleteness: number; // percentage (0 - 100)
  xGAvailable: boolean;
  checksum: string;
  verificationStatus: 'Verified' | 'Unverified';
  auditNotes: string[];
}

export class DatasetRegistry {
  private projectRoot: string;
  private registryDir: string;
  private eplDataDir: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.registryDir = path.join(this.projectRoot, 'data', 'registry');
    this.eplDataDir = path.join(this.projectRoot, 'data', 'EPL');
  }

  /**
   * Computes the SHA-256 hash of a file.
   */
  private calculateFileHash(filePath: string): string {
    if (!fs.existsSync(filePath)) return '';
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Reads the checksums mapping file.
   */
  private getExpectedChecksums(): Record<string, string> {
    const checksumsPath = path.join(this.eplDataDir, 'checksums.json');
    if (!fs.existsSync(checksumsPath)) return {};
    try {
      return JSON.parse(fs.readFileSync(checksumsPath, 'utf-8'));
    } catch {
      return {};
    }
  }

  /**
   * Audits a specific historical CSV file.
   */
  auditDataset(filePath: string, league: string, season: string): DatasetMetadata {
    const filename = path.basename(filePath);
    const notes: string[] = [];
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length === 0) {
      throw new Error(`File is empty: ${filePath}`);
    }

    const headers = lines[0].split(',');
    const rowsCount = lines.length - 1;

    let validOpening = 0;
    let validClosing = 0;
    let hasXG = false;

    // Check for xG columns
    const xgCols = headers.filter(h => h.toLowerCase().includes('xg'));
    if (xgCols.length > 0) {
      hasXG = true;
    } else {
      notes.push('xG data is not available in this dataset.');
    }

    // Determine indices for odds
    // Opening Odds: B365H, B365D, B365A or PSH, PSD, PSA
    const homeOddsIdx = headers.indexOf('B365H') !== -1 ? headers.indexOf('B365H') : headers.indexOf('PSH');
    const drawOddsIdx = headers.indexOf('B365D') !== -1 ? headers.indexOf('B365D') : headers.indexOf('PSD');
    const awayOddsIdx = headers.indexOf('B365A') !== -1 ? headers.indexOf('B365A') : headers.indexOf('PSA');

    // Closing Odds: B365CH, B365CD, B365CA or PSCH, PSCD, PSCA
    const closingHomeOddsIdx = headers.indexOf('B365CH') !== -1 ? headers.indexOf('B365CH') : headers.indexOf('PSCH');
    const closingDrawOddsIdx = headers.indexOf('B365CD') !== -1 ? headers.indexOf('B365CD') : headers.indexOf('PSCD');
    const closingAwayOddsIdx = headers.indexOf('B365CA') !== -1 ? headers.indexOf('B365CA') : headers.indexOf('PSCA');

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      
      // Audit opening odds
      if (homeOddsIdx !== -1 && drawOddsIdx !== -1 && awayOddsIdx !== -1) {
        const h = parseFloat(cols[homeOddsIdx]);
        const d = parseFloat(cols[drawOddsIdx]);
        const a = parseFloat(cols[awayOddsIdx]);
        if (h > 1 && d > 1 && a > 1) {
          validOpening++;
        }
      }

      // Audit closing odds
      if (closingHomeOddsIdx !== -1 && closingDrawOddsIdx !== -1 && closingAwayOddsIdx !== -1) {
        const h = parseFloat(cols[closingHomeOddsIdx]);
        const d = parseFloat(cols[closingDrawOddsIdx]);
        const a = parseFloat(cols[closingAwayOddsIdx]);
        if (h > 1 && d > 1 && a > 1) {
          validClosing++;
        }
      }
    }

    const openingOddsCompleteness = rowsCount > 0 ? Math.round((validOpening / rowsCount) * 10000) / 100 : 0;
    const closingOddsCompleteness = rowsCount > 0 ? Math.round((validClosing / rowsCount) * 10000) / 100 : 0;

    const actualHash = this.calculateFileHash(filePath);
    const expectedChecksums = this.getExpectedChecksums();
    const expectedHash = expectedChecksums[filename];

    let verificationStatus: 'Verified' | 'Unverified' = 'Unverified';
    if (expectedHash && expectedHash === actualHash) {
      verificationStatus = 'Verified';
    } else {
      notes.push(`Checksum mismatch. Expected: ${expectedHash || 'None'}, Actual: ${actualHash}`);
    }

    if (openingOddsCompleteness < 90) {
      notes.push(`Opening odds completeness is low: ${openingOddsCompleteness}%`);
    }
    if (closingOddsCompleteness < 90) {
      notes.push(`Closing odds completeness is low: ${closingOddsCompleteness}%`);
    }

    return {
      provider: 'football-data',
      league,
      season,
      filePath,
      rowsCount,
      columnsAvailable: headers,
      openingOddsCompleteness,
      closingOddsCompleteness,
      xGAvailable: hasXG,
      checksum: actualHash,
      verificationStatus,
      auditNotes: notes,
    };
  }

  /**
   * Audits all seasons in the EPL data directory.
   */
  auditAll(): DatasetMetadata[] {
    const results: DatasetMetadata[] = [];
    const seasons = ['2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'];
    
    for (const season of seasons) {
      const csvPath = path.join(this.eplDataDir, `${season}.csv`);
      if (fs.existsSync(csvPath)) {
        results.push(this.auditDataset(csvPath, 'EPL', season));
      }
    }

    // Save metadata report to registry directory
    if (!fs.existsSync(this.registryDir)) {
      fs.mkdirSync(this.registryDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(this.registryDir, 'audited_metadata.json'),
      JSON.stringify(results, null, 2),
      'utf-8'
    );

    return results;
  }
}
