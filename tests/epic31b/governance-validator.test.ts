/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Governance Validator Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GovernanceValidator } from '../../src/lib/epic31b/governance-validator';

describe('EPIC 31B — Governance Validator', () => {
  const testDir = path.join(process.cwd(), 'test-epic31b-gov');
  let validator: GovernanceValidator;

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    validator = new GovernanceValidator(testDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should pass when all governance files exist', () => {
    const requiredFiles = [
      'feature_registry.json',
      'research_manifest.json',
      'experiment_registry.json',
      'model_registry.json',
      'package.json',
      'tsconfig.json',
    ];

    for (const file of requiredFiles) {
      if (file === 'research_manifest.json') {
        fs.writeFileSync(path.join(testDir, file), JSON.stringify({
          experimentId: 'test-exp',
          datasetVersion: 'v1',
          featureVersion: 'v1',
          modelVersion: 'v1',
          seed: 42,
        }, null, 2));
      } else if (file === 'experiment_registry.json' || file === 'model_registry.json') {
        fs.writeFileSync(path.join(testDir, file), JSON.stringify([], null, 2));
      } else {
        fs.writeFileSync(path.join(testDir, file), JSON.stringify({ test: true }, null, 2));
      }
    }

    const artifactsDir = path.join(testDir, 'artifacts');
    fs.mkdirSync(path.join(artifactsDir, 'model_versions'), { recursive: true });
    fs.mkdirSync(path.join(artifactsDir, 'feature_versions'), { recursive: true });
    fs.mkdirSync(path.join(artifactsDir, 'dataset_versions'), { recursive: true });

    fs.mkdirSync(path.join(testDir, 'src', 'scripts'), { recursive: true });

    const result = validator.validate();

    expect(result.featureFlagsVerified).toBe(true);
    expect(result.researchRegistryVerified).toBe(true);
    expect(result.experimentRegistryVerified).toBe(true);
    expect(result.modelRegistryVerified).toBe(true);
    expect(result.artifactMetadataVerified).toBe(true);
    expect(result.executionMetadataVerified).toBe(true);
    expect(result.versionTraceabilityVerified).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('should fail when feature_registry.json is missing', () => {
    const result = validator.validate();
    expect(result.featureFlagsVerified).toBe(false);
    expect(result.issues.some((i) => i.includes('feature_registry.json'))).toBe(true);
  });

  it('should fail when research_manifest.json is missing required fields', () => {
    fs.writeFileSync(path.join(testDir, 'feature_registry.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(testDir, 'research_manifest.json'), JSON.stringify({ name: 'test' }));
    fs.writeFileSync(path.join(testDir, 'experiment_registry.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(testDir, 'model_registry.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(testDir, 'tsconfig.json'), JSON.stringify({}));

    fs.mkdirSync(path.join(testDir, 'artifacts', 'model_versions'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'artifacts', 'feature_versions'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'artifacts', 'dataset_versions'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'src', 'scripts'), { recursive: true });

    const result = validator.validate();
    expect(result.researchRegistryVerified).toBe(false);
    expect(result.issues.some((i) => i.includes('missing fields'))).toBe(true);
  });

  it('should fail when experiment_registry.json is invalid', () => {
    fs.writeFileSync(path.join(testDir, 'feature_registry.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(testDir, 'research_manifest.json'), JSON.stringify({
      experimentId: 'test',
      datasetVersion: 'v1',
      featureVersion: 'v1',
      modelVersion: 'v1',
      seed: 42,
    }));
    fs.writeFileSync(path.join(testDir, 'experiment_registry.json'), JSON.stringify({ not: 'array' }));
    fs.writeFileSync(path.join(testDir, 'model_registry.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(testDir, 'tsconfig.json'), JSON.stringify({}));

    fs.mkdirSync(path.join(testDir, 'artifacts', 'model_versions'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'artifacts', 'feature_versions'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'artifacts', 'dataset_versions'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'src', 'scripts'), { recursive: true });

    const result = validator.validate();
    expect(result.experimentRegistryVerified).toBe(false);
    expect(result.issues.some((i) => i.includes('not an array'))).toBe(true);
  });
});
