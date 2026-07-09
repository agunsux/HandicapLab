/**
 * Pipeline Contract Documentation Generator
 * ===========================================
 * Auto-generates comprehensive Markdown documentation from contracts.
 * Run: npx ts-node src/lib/pipeline/contracts/generate-docs.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { ContractValidator, PIPELINE_CONTRACTS } from './index';
import { registerAllContracts } from './steps';

// Register all contracts
registerAllContracts();

function generateFullDocumentation(): string {
  const steps = Object.values(PIPELINE_CONTRACTS);

  let doc = `# Pipeline Reliability Contracts\n\n`;
  doc += `**Generated**: ${new Date().toISOString()}\n`;
  doc += `**Pipeline Steps**: ${steps.length}\n\n`;
  doc += `This document is auto-generated from the TypeScript contract definitions in \`src/lib/pipeline/contracts/\`.\n`;
  doc += `Each contract is the source of truth for state machine transitions, recovery strategies, and observability.\n\n`;

  doc += '---\n\n';

  doc += '## Pipeline Dependency Graph\n\n';
  doc += '```\n';
  doc += printDependencyGraph(steps);
  doc += '```\n\n';

  doc += '---\n\n';

  for (const contract of steps) {
    doc += ContractValidator.toMarkdown(contract);
    doc += '\n---\n\n';
  }

  // Summary tables
  doc += '## Summary\n\n';

  doc += '### Failure Modes\n\n';
  doc += '| Step | Failure Mode | Recovery |\n';
  doc += '|---|---|---|\n';
  for (const s of steps) {
    doc += `| ${s.stepId} | ${s.failureMode} | ${JSON.stringify(s.recoveryStrategy)} |\n`;
  }

  doc += '\n### Retry Policies\n\n';
  doc += '| Step | Policy |\n';
  doc += '|---|---|\n';
  for (const s of steps) {
    const policy = s.retryPolicy.type === 'no_retry' ? 'No retry' :
      s.retryPolicy.type === 'exponential_backoff' ? `Exponential backoff (${s.retryPolicy.maxAttempts}x)` :
      s.retryPolicy.type;
    doc += `| ${s.stepId} | ${policy} |\n`;
  }

  doc += '\n### Idempotency\n\n';
  doc += '| Step | Scheme | Keys |\n';
  doc += '|---|---|---|\n';
  for (const s of steps) {
    doc += `| ${s.stepId} | ${s.idempotency.type} | ${JSON.stringify(s.idempotency)} |\n`;
  }

  doc += '\n### Metrics\n\n';
  doc += '| Step | Metric | Type |\n';
  doc += '|---|---|---|\n';
  for (const s of steps) {
    for (const m of s.metrics) {
      doc += `| ${s.stepId} | \`${m.name}\` | ${m.type} |\n`;
    }
  }

  return doc;
}

function printDependencyGraph(steps: typeof PIPELINE_CONTRACTS[keyof typeof PIPELINE_CONTRACTS][]): string {
  // Build adjacency
  const deps: Record<string, string[]> = {};
  for (const s of steps) {
    deps[s.stepId] = s.dependsOn;
  }

  // Topological sort
  const visited = new Set<string>();
  const sorted: string[] = [];

  function visit(node: string) {
    if (visited.has(node)) return;
    visited.add(node);
    for (const dep of deps[node] || []) {
      visit(dep);
    }
    sorted.push(node);
  }

  // Find roots (no dependencies)
  const roots = steps.filter(s => s.dependsOn.length === 0).map(s => s.stepId);
  for (const root of roots) {
    visit(root);
  }

  // Print tree
  let result = '';
  const printed = new Set<string>();
  for (const node of sorted) {
    const indent = deps[node]?.length > 0 ? '    ' : '';
    const prefix = deps[node]?.length > 0 ? '│   ' : '';
    const children = steps.filter(s => s.dependsOn.includes(node));
    result += `${prefix}${node}\n`;
    printed.add(node);
  }

  // Fallback if empty
  if (!result) {
    for (const s of steps) {
      result += `${s.stepId}\n`;
    }
  }

  return result;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const outputPath = path.join(__dirname, '..', '..', '..', '..', 'docs', 'pipeline-contracts.md');
  const doc = generateFullDocumentation();

  // Create docs directory if it doesn't exist
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, doc, 'utf-8');
  console.log(`✅ Contract documentation written to: ${outputPath}`);
  console.log(`   ${Object.keys(PIPELINE_CONTRACTS).length} pipeline steps documented`);
}

main();