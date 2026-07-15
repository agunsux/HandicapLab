/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Phase 6: Governance Validator
 *
 * Verifies Feature Flags, Research Registry, Experiment Registry,
 * Model Registry, Artifact Metadata, Execution Metadata,
 * and Version Traceability.
 */

import fs from 'fs';
import path from 'path';

export class GovernanceValidator {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  validate(): {
    featureFlagsVerified: boolean;
    researchRegistryVerified: boolean;
    experimentRegistryVerified: boolean;
    modelRegistryVerified: boolean;
    artifactMetadataVerified: boolean;
    executionMetadataVerified: boolean;
    versionTraceabilityVerified: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    const featureFlagsVerified = this.verifyFeatureFlags(issues);
    const researchRegistryVerified = this.verifyResearchRegistry(issues);
    const experimentRegistryVerified = this.verifyExperimentRegistry(issues);
    const modelRegistryVerified = this.verifyModelRegistry(issues);
    const artifactMetadataVerified = this.verifyArtifactMetadata(issues);
    const executionMetadataVerified = this.verifyExecutionMetadata(issues);
    const versionTraceabilityVerified = this.verifyVersionTraceability(issues);

    return {
      featureFlagsVerified,
      researchRegistryVerified,
      experimentRegistryVerified,
      modelRegistryVerified,
      artifactMetadataVerified,
      executionMetadataVerified,
      versionTraceabilityVerified,
      issues,
    };
  }

  private verifyFeatureFlags(issues: string[]): boolean {
    const featureRegistryPath = path.join(this.projectRoot, 'feature_registry.json');
    if (!fs.existsSync(featureRegistryPath)) {
      issues.push('Missing feature_registry.json');
      return false;
    }

    try {
      const registry = JSON.parse(fs.readFileSync(featureRegistryPath, 'utf-8'));
      if (!Array.isArray(registry) && typeof registry !== 'object') {
        issues.push('feature_registry.json is not a valid JSON object or array');
        return false;
      }
      return true;
    } catch {
      issues.push('feature_registry.json is not valid JSON');
      return false;
    }
  }

  private verifyResearchRegistry(issues: string[]): boolean {
    const researchManifestPath = path.join(this.projectRoot, 'research_manifest.json');
    if (!fs.existsSync(researchManifestPath)) {
      issues.push('Missing research_manifest.json');
      return false;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(researchManifestPath, 'utf-8'));
      const requiredFields = ['experimentId', 'datasetVersion', 'featureVersion', 'modelVersion', 'seed'];
      const missing = requiredFields.filter((f) => !(f in manifest));
      if (missing.length > 0) {
        issues.push(`research_manifest.json missing fields: ${missing.join(', ')}`);
        return false;
      }
      return true;
    } catch {
      issues.push('research_manifest.json is not valid JSON');
      return false;
    }
  }

  private verifyExperimentRegistry(issues: string[]): boolean {
    const experimentRegistryPath = path.join(this.projectRoot, 'experiment_registry.json');
    if (!fs.existsSync(experimentRegistryPath)) {
      issues.push('Missing experiment_registry.json');
      return false;
    }

    try {
      const registry = JSON.parse(fs.readFileSync(experimentRegistryPath, 'utf-8'));
      const list = Array.isArray(registry) ? registry : (registry && registry.entries);
      if (!Array.isArray(list)) {
        issues.push('experiment_registry.json is not an array and does not contain entries');
        return false;
      }
      return true;
    } catch {
      issues.push('experiment_registry.json is not valid JSON');
      return false;
    }
  }

  private verifyModelRegistry(issues: string[]): boolean {
    const modelRegistryPath = path.join(this.projectRoot, 'model_registry.json');
    if (!fs.existsSync(modelRegistryPath)) {
      issues.push('Missing model_registry.json');
      return false;
    }

    try {
      const registry = JSON.parse(fs.readFileSync(modelRegistryPath, 'utf-8'));
      const list = Array.isArray(registry) ? registry : (registry && registry.models);
      if (!Array.isArray(list)) {
        issues.push('model_registry.json is not an array and does not contain models');
        return false;
      }
      return true;
    } catch {
      issues.push('model_registry.json is not valid JSON');
      return false;
    }
  }

  private verifyArtifactMetadata(issues: string[]): boolean {
    const artifactsDir = path.join(this.projectRoot, 'artifacts');
    if (!fs.existsSync(artifactsDir)) {
      issues.push('Missing artifacts/ directory');
      return false;
    }

    const requiredArtifacts = ['model_versions', 'feature_versions', 'dataset_versions'];
    const missing = requiredArtifacts.filter((a) => !fs.existsSync(path.join(artifactsDir, a)));
    if (missing.length > 0) {
      issues.push(`Missing artifact directories: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }

  private verifyExecutionMetadata(issues: string[]): boolean {
    const scriptsDir = path.join(this.projectRoot, 'src', 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      issues.push('Missing src/scripts/ directory');
      return false;
    }

    return true;
  }

  private verifyVersionTraceability(issues: string[]): boolean {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'research_manifest.json',
      'model_registry.json',
      'experiment_registry.json',
    ];

    const missing = requiredFiles.filter((f) => !fs.existsSync(path.join(this.projectRoot, f)));
    if (missing.length > 0) {
      issues.push(`Missing version traceability files: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }
}
