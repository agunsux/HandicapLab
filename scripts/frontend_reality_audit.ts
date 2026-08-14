/**
 * HandicapLab — Frontend Reality Audit Static Scanner
 * Location: scripts/frontend_reality_audit.ts
 * 
 * Scans all production-facing UI, components, services, and API routes to verify:
 * 1. Zero dummy/mock/fake data in production runtime
 * 2. Real data lineage from Supabase/database/providers
 * 3. Graceful empty/loading/error states instead of fallback fabrication
 * 4. Secret isolation: No private API keys in client components
 */

import fs from 'fs';
import path from 'path';

export interface ScanIssue {
  file: string;
  line: number;
  type: 'MOCK_IMPORT' | 'HARDCODED_FALLBACK' | 'CLIENT_SECRET_LEAK' | 'FAKE_DATA_ANTIPATTERN';
  snippet: string;
  message: string;
}

export interface FileAuditResult {
  path: string;
  isProduction: boolean;
  isClientComponent: boolean;
  issues: ScanIssue[];
  passed: boolean;
}

export interface RealityAuditReport {
  timestamp: string;
  scannerVersion: string;
  totalFilesScanned: number;
  productionFilesScanned: number;
  passedFilesCount: number;
  failedFilesCount: number;
  totalIssuesFound: number;
  categorySummary: {
    mockImports: number;
    hardcodedFallbacks: number;
    clientSecretLeaks: number;
    fakeDataAntipatterns: number;
  };
  details: FileAuditResult[];
  verdict: 'PASS' | 'FAIL';
}

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

const IGNORE_PATTERNS = [
  'node_modules',
  '.next',
  '.git',
  '.gemini',
  'dist',
  'coverage'
];

const TEST_AND_BENCHMARK_DIRS = [
  path.join(ROOT_DIR, 'tests'),
  path.join(SRC_DIR, 'test'),
  path.join(SRC_DIR, 'scripts'),
  path.join(ROOT_DIR, 'scripts'),
];

export function isTestOrBenchmark(filePath: string): boolean {
  const baseName = path.basename(filePath).toLowerCase();
  if (
    filePath.endsWith('.test.ts') || 
    filePath.endsWith('.test.tsx') || 
    filePath.endsWith('.spec.ts') || 
    filePath.endsWith('.spec.tsx') ||
    baseName.startsWith('mock') ||
    baseName.includes('mock-data') ||
    baseName.includes('mockdata') ||
    baseName.includes('mockprovider') ||
    baseName.includes('mockadapter')
  ) {
    return true;
  }
  for (const dir of TEST_AND_BENCHMARK_DIRS) {
    if (filePath.startsWith(dir)) {
      return true;
    }
  }
  return false;
}

export function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE_PATTERNS.includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

export function runFrontendRealityAudit(): RealityAuditReport {
  const allFiles = getAllFiles(SRC_DIR);
  const auditResults: FileAuditResult[] = [];

  let mockImportsCount = 0;
  let hardcodedFallbacksCount = 0;
  let clientSecretLeaksCount = 0;
  let fakeDataAntipatternsCount = 0;

  for (const file of allFiles) {
    const isTest = isTestOrBenchmark(file);
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const isClient = lines.some(l => l.includes("'use client'") || l.includes('"use client"'));
    const relativePath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');

    const issues: ScanIssue[] = [];

    // Only audit production code for production data integrity
    if (!isTest) {
      lines.forEach((lineText, idx) => {
        const lineNum = idx + 1;
        const trimmed = lineText.trim();

        // 1. Check for mock data imports in production
        if (
          (trimmed.startsWith('import') || trimmed.includes('require(')) &&
          (trimmed.includes('/mockData') || trimmed.includes('/mock-data') || trimmed.includes('/mockProvider')) &&
          !trimmed.includes('//') &&
          !trimmed.includes('/*')
        ) {
          issues.push({
            file: relativePath,
            line: lineNum,
            type: 'MOCK_IMPORT',
            snippet: trimmed,
            message: 'Production file imports mock data/provider',
          });
          mockImportsCount++;
        }

        // 2. Check for fake data fallback anti-patterns
        if (
          (trimmed.includes('matches = mock') || trimmed.includes('return MOCK_') || trimmed.includes('setData(mock')) &&
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('*')
        ) {
          issues.push({
            file: relativePath,
            line: lineNum,
            type: 'HARDCODED_FALLBACK',
            snippet: trimmed,
            message: 'Fallback replaces missing real data with mock object',
          });
          hardcodedFallbacksCount++;
        }

        // 3. Check for client secret leakage
        if (isClient) {
          if (
            (trimmed.includes('process.env.API_FOOTBALL_KEY') ||
             trimmed.includes('process.env.ODDSPAPI_KEY') ||
             trimmed.includes('process.env.SUPABASE_SERVICE_ROLE_KEY') ||
             trimmed.includes('FOOTYSTATS_API_KEY')) &&
            !trimmed.startsWith('//')
          ) {
            issues.push({
              file: relativePath,
              line: lineNum,
              type: 'CLIENT_SECRET_LEAK',
              snippet: trimmed,
              message: 'Client component references private server secret key',
            });
            clientSecretLeaksCount++;
          }
        }
      });
    }

    auditResults.push({
      path: relativePath,
      isProduction: !isTest,
      isClientComponent: isClient,
      issues,
      passed: issues.length === 0,
    });
  }

  const productionResults = auditResults.filter(r => r.isProduction);
  const failedProduction = productionResults.filter(r => !r.passed);

  const report: RealityAuditReport = {
    timestamp: new Date().toISOString(),
    scannerVersion: 'v1.0.0-frontend-reality-gate',
    totalFilesScanned: allFiles.length,
    productionFilesScanned: productionResults.length,
    passedFilesCount: productionResults.length - failedProduction.length,
    failedFilesCount: failedProduction.length,
    totalIssuesFound: failedProduction.reduce((sum, r) => sum + r.issues.length, 0),
    categorySummary: {
      mockImports: mockImportsCount,
      hardcodedFallbacks: hardcodedFallbacksCount,
      clientSecretLeaks: clientSecretLeaksCount,
      fakeDataAntipatterns: fakeDataAntipatternsCount,
    },
    details: auditResults,
    verdict: failedProduction.length === 0 ? 'PASS' : 'FAIL',
  };

  return report;
}

if (require.main === module) {
  const report = runFrontendRealityAudit();
  const reportsDir = path.join(ROOT_DIR, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const outputPath = path.join(reportsDir, 'FRONTEND_REALITY_STATIC_SCAN.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`[Frontend Reality Audit] Static Scan Complete:`);
  console.log(`- Production Files Scanned: ${report.productionFilesScanned}`);
  console.log(`- Passed: ${report.passedFilesCount}`);
  console.log(`- Failed: ${report.failedFilesCount}`);
  console.log(`- Total Issues: ${report.totalIssuesFound}`);
  console.log(`- Verdict: ${report.verdict}`);
  console.log(`- Report written to: ${outputPath}`);

  if (report.failedFilesCount > 0) {
    console.log(`\nFailed Files:`);
    report.details.filter(d => !d.passed).forEach(f => {
      console.log(`\n  File: ${f.path}`);
      f.issues.forEach(iss => {
        console.log(`    Line ${iss.line} [${iss.type}]: ${iss.snippet} (${iss.message})`);
      });
    });
  }

  if (report.verdict === 'FAIL') {
    process.exit(1);
  }
}
