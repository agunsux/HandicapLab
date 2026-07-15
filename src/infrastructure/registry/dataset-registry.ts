import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Registry, ValidationResult } from '../../domain/registry';
import type { DatasetMetadata, SourceType } from '../../domain/dataset/types';

export class DatasetRegistry implements Registry<DatasetMetadata> {
  private projectRoot: string;
  private eplDataDir: string;
  private registeredItems: Map<string, DatasetMetadata> = new Map();

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.eplDataDir = path.join(this.projectRoot, 'data', 'EPL');
  }

  /**
   * Calculates the SHA-256 hash of a file.
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
   * Registers a dataset item.
   */
  async register(item: DatasetMetadata): Promise<void> {
    this.registeredItems.set(item.datasetId, item);
  }

  /**
   * Gets a registered dataset.
   */
  async get(id: string): Promise<DatasetMetadata> {
    const item = this.registeredItems.get(id);
    if (!item) {
      throw new Error(`Dataset with ID ${id} not found in registry.`);
    }
    return item;
  }

  /**
   * Lists all registered datasets.
   */
  async list(): Promise<DatasetMetadata[]> {
    return Array.from(this.registeredItems.values());
  }

  /**
   * Validates a dataset checksum and metadata.
   */
  async validate(id: string): Promise<ValidationResult> {
    const item = await this.get(id);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!fs.existsSync(item.filePath)) {
      errors.push(`Dataset file does not exist at path: ${item.filePath}`);
      return { isValid: false, errors, warnings };
    }

    const currentHash = this.calculateFileHash(item.filePath);
    if (currentHash !== item.hash) {
      errors.push(`Dataset checksum mismatch. Expected: ${item.hash}, Got: ${currentHash}`);
    }

    if (item.openingOddsCompleteness < 90) {
      warnings.push(`Low opening odds completeness: ${item.openingOddsCompleteness}%`);
    }

    if (item.closingOddsCompleteness < 90) {
      warnings.push(`Low closing odds completeness: ${item.closingOddsCompleteness}%`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Audits a specific historical CSV file and registers it.
   */
  async auditAndRegister(filePath: string, league: string, season: string): Promise<DatasetMetadata> {
    const filename = path.basename(filePath);
    const datasetId = `DS-${league}-${season}`.replace(/\s+/g, '-');
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
    const matchesCount = lines.length - 1;

    let validOpening = 0;
    let validClosing = 0;
    let validAH = 0;
    let validOU = 0;
    let hasXG = false;

    // Check for xG columns
    const xgCols = headers.filter(h => h.toLowerCase().includes('xg'));
    if (xgCols.length > 0) {
      hasXG = true;
    } else {
      notes.push('xG data is not available in Tier 1 dataset.');
    }

    const homeOddsIdx = headers.indexOf('B365H') !== -1 ? headers.indexOf('B365H') : headers.indexOf('PSH');
    const drawOddsIdx = headers.indexOf('B365D') !== -1 ? headers.indexOf('B365D') : headers.indexOf('PSD');
    const awayOddsIdx = headers.indexOf('B365A') !== -1 ? headers.indexOf('B365A') : headers.indexOf('PSA');

    const closingHomeOddsIdx = headers.indexOf('B365CH') !== -1 ? headers.indexOf('B365CH') : headers.indexOf('PSCH');
    const closingDrawOddsIdx = headers.indexOf('B365CD') !== -1 ? headers.indexOf('B365CD') : headers.indexOf('PSCD');
    const closingAwayOddsIdx = headers.indexOf('B365CA') !== -1 ? headers.indexOf('B365CA') : headers.indexOf('PSCA');

    const ahLineIdx = headers.indexOf('AHCh');
    const ouLineIdx = headers.indexOf('AvgC>2.5');

    let fullCrowd = 0;
    let limitedCrowd = 0;
    let closedDoor = 0;
    let unknownCrowd = 0;

    // Parse date index
    const dateIdx = headers.indexOf('Date');

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < headers.length) continue;

      const hOdds = parseFloat(cols[homeOddsIdx]);
      const dOdds = parseFloat(cols[drawOddsIdx]);
      const aOdds = parseFloat(cols[awayOddsIdx]);
      if (!isNaN(hOdds) && hOdds > 1 && !isNaN(dOdds) && dOdds > 1 && !isNaN(aOdds) && aOdds > 1) {
        validOpening++;
      }

      const chOdds = parseFloat(cols[closingHomeOddsIdx]);
      const cdOdds = parseFloat(cols[closingDrawOddsIdx]);
      const caOdds = parseFloat(cols[closingAwayOddsIdx]);
      if (!isNaN(chOdds) && chOdds > 1 && !isNaN(cdOdds) && cdOdds > 1 && !isNaN(caOdds) && caOdds > 1) {
        validClosing++;
      }

      if (ahLineIdx !== -1 && cols[ahLineIdx] && cols[ahLineIdx] !== '') {
        validAH++;
      }

      if (ouLineIdx !== -1 && cols[ouLineIdx] && cols[ouLineIdx] !== '') {
        validOU++;
      }

      // Assign crowd regime based on date and season
      if (season === '2020-2021') {
        closedDoor++;
      } else if (season === '2021-2022') {
        // EPL 2021/22 had full return from start of season (August 2021)
        fullCrowd++;
      } else {
        fullCrowd++;
      }
    }

    const openingOddsCompleteness = matchesCount > 0 ? (validOpening / matchesCount) * 100 : 0;
    const closingOddsCompleteness = matchesCount > 0 ? (validClosing / matchesCount) * 100 : 0;
    const ahCompleteness = matchesCount > 0 ? (validAH / matchesCount) * 100 : 0;
    const ouCompleteness = matchesCount > 0 ? (validOU / matchesCount) * 100 : 0;

    const hash = this.calculateFileHash(filePath);
    const expectedChecksums = this.getExpectedChecksums();
    const expectedHash = expectedChecksums[filename];
    
    let verificationStatus: 'Verified' | 'Unverified' = 'Unverified';
    if (expectedHash && expectedHash === hash) {
      verificationStatus = 'Verified';
    } else {
      notes.push(`Checksum mismatch or missing in checksums.json. Expected: ${expectedHash || 'None'}, Got: ${hash}`);
    }

    const dataQualityScore = Math.round(
      (openingOddsCompleteness + closingOddsCompleteness + (hasXG ? 100 : 0) + (validAH > 0 ? 100 : 0)) / 4
    );

    const metadata: DatasetMetadata = {
      datasetId,
      source: 'football-data.co.uk',
      sourceType: 'historical_archive',
      league,
      season,
      coverage: {
        matchesCount,
        startDate: 'N/A',
        endDate: 'N/A',
      },
      hash,
      downloadTimestamp: new Date().toISOString(),
      openingOddsCompleteness: Math.round(openingOddsCompleteness * 100) / 100,
      closingOddsCompleteness: Math.round(closingOddsCompleteness * 100) / 100,
      ahCompleteness: Math.round(ahCompleteness * 100) / 100,
      ouCompleteness: Math.round(ouCompleteness * 100) / 100,
      xGAvailability: hasXG,
      bookmakerCoverage: ['Bet365', 'Pinnacle', 'William Hill', 'Ladbrokes'],
      verificationStatus,
      dataQualityScore,
      crowdAttendanceRegimeCoverage: {
        full: fullCrowd,
        limited: limitedCrowd,
        closedDoor: closedDoor,
        unknown: unknownCrowd,
      },
      filePath,
      auditNotes: notes,
    };

    await this.register(metadata);
    return metadata;
  }

  /**
   * Audit all EPL datasets
   */
  async auditAll(): Promise<DatasetMetadata[]> {
    const seasons = ['2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'];
    for (const season of seasons) {
      const filePath = path.join(this.eplDataDir, `${season}.csv`);
      if (fs.existsSync(filePath)) {
        await this.auditAndRegister(filePath, 'EPL', season);
      }
    }
    return this.list();
  }
}
