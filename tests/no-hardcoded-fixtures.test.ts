import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Invariant Test: Zero Dummy & Zero Hardcoded Fixtures in Production Pipeline', () => {
  const pipelinePath = path.join(process.cwd(), 'src/lib/pipeline/dailyAhShadowPipeline.ts');
  const pipelineCode = fs.existsSync(pipelinePath) ? fs.readFileSync(pipelinePath, 'utf-8') : '';

  it('verifies dailyAhShadowPipeline exists', () => {
    expect(pipelineCode.length).toBeGreaterThan(0);
  });

  it('contains NO hardcoded team names', () => {
    const forbidden = ['Liverpool', 'Everton', 'Arsenal', 'Chelsea', 'Real Madrid', 'Genoa', 'Cagliari', 'Chievo'];
    for (const team of forbidden) {
      const regex = new RegExp(`['"\`]${team}['"\`]`, 'i');
      expect(pipelineCode).not.toMatch(regex);
    }
  });

  it('contains NO synthetic odds constants or golden file fallbacks in live path', () => {
    expect(pipelineCode).not.toContain('canonical_matches.jsonl');
    expect(pipelineCode).not.toMatch(/1\.95\s*,\s*1\.95/);
    expect(pipelineCode).not.toMatch(/modelProb\s*=\s*0\.518/);
  });
});
