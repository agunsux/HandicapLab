import { CanonicalFixture, CanonicalField, MergeReasonType } from '../../domain/dataset/canonical';

export interface MergeConflict {
  fixtureNaturalKey: string;
  field: string;
  providerA: string;
  valueA: any;
  confidenceA: number;
  providerB: string;
  valueB: any;
  confidenceB: number;
  selectedValue: any;
  selectedProvider: string;
  reason: string;
}

export class CanonicalMergeEngine {
  private static readonly confidenceMatrix: Record<string, Record<string, number>> = {
    'football-data.co.uk': {
      kickoff: 0.99,
      goals: 0.999,
      shots: 0.98,
      shotsOnTarget: 0.98,
      referee: 0.97,
      odds: 0.995,
      xg: 0.0,
    },
    'understat': {
      kickoff: 0.90,
      goals: 0.80,
      shots: 0.95,
      shotsOnTarget: 0.95,
      referee: 0.0,
      odds: 0.0,
      xg: 0.995,
    },
    'football-data.org': {
      kickoff: 0.95,
      goals: 0.95,
      shots: 0.0,
      referee: 0.0,
      odds: 0.0,
      xg: 0.0,
    }
  };

  private conflicts: MergeConflict[] = [];

  public getConflicts(): MergeConflict[] {
    return this.conflicts;
  }

  public clearConflicts(): void {
    this.conflicts = [];
  }

  /**
   * Merges multiple raw fixture updates into a single CanonicalFixture.
   */
  public merge(
    fixtureNaturalKey: string,
    fixtureId: string,
    competitionId: string,
    seasonId: string,
    homeTeamId: string,
    awayTeamId: string,
    candidates: { provider: string; data: Partial<CanonicalFixture>; providerVersion: string }[]
  ): CanonicalFixture {
    
    const selectField = <T>(
      fieldName: string,
      extractor: (data: Partial<CanonicalFixture>) => T | null | undefined
    ): CanonicalField<T> => {
      let selectedValue: T | null = null;
      let selectedSource = 'none';
      let selectedConfidence = -1;
      let reason: MergeReasonType = 'derived';

      // Find all candidates that have this field defined
      const validCandidates = candidates
        .map(c => {
          const val = extractor(c.data);
          const confidence = CanonicalMergeEngine.confidenceMatrix[c.provider]?.[fieldName] ?? 0.5;
          return {
            provider: c.provider,
            value: val,
            confidence
          };
        })
        .filter(c => c.value !== undefined && c.value !== null);

      if (validCandidates.length === 1) {
        selectedValue = validCandidates[0].value as T;
        selectedSource = validCandidates[0].provider;
        selectedConfidence = validCandidates[0].confidence;
        reason = 'highest_confidence';
      } else if (validCandidates.length > 1) {
        // Sort by confidence descending
        validCandidates.sort((a, b) => b.confidence - a.confidence);
        
        const best = validCandidates[0];
        const next = validCandidates[1];
        
        selectedValue = best.value as T;
        selectedSource = best.provider;
        selectedConfidence = best.confidence;
        reason = 'highest_confidence';

        // Check for conflict: different values
        if (JSON.stringify(best.value) !== JSON.stringify(next.value)) {
          this.conflicts.push({
            fixtureNaturalKey,
            field: fieldName,
            providerA: best.provider,
            valueA: best.value,
            confidenceA: best.confidence,
            providerB: next.provider,
            valueB: next.value,
            confidenceB: next.confidence,
            selectedValue,
            selectedProvider: selectedSource,
            reason: `Value conflict: selected ${best.provider} over ${next.provider} due to higher confidence.`
          });
        }
      }

      return {
        value: selectedValue,
        source: selectedSource,
        confidence: selectedConfidence,
        mergeReason: reason
      };
    };

    const kickoff = selectField('kickoff', d => d.kickoff?.value);
    const homeGoals = selectField('goals', d => d.homeGoals?.value);
    const awayGoals = selectField('goals', d => d.awayGoals?.value);
    const homeXg = selectField('xg', d => d.homeXg?.value);
    const awayXg = selectField('xg', d => d.awayXg?.value);
    const homeShots = selectField('shots', d => d.homeShots?.value);
    const awayShots = selectField('shots', d => d.awayShots?.value);
    const homeShotsOnTarget = selectField('shotsOnTarget', d => d.homeShotsOnTarget?.value);
    const awayShotsOnTarget = selectField('shotsOnTarget', d => d.awayShotsOnTarget?.value);
    const referee = selectField('referee', d => d.referee?.value);
    const regime = selectField('regime', d => d.regime?.value);

    // Build lineage records
    const lineage = candidates.map(c => {
      const checksum = require('crypto')
        .createHash('sha256')
        .update(JSON.stringify(c.data))
        .digest('hex');
      return {
        provider: c.provider,
        providerVersion: c.providerVersion,
        importTimestamp: new Date().toISOString(),
        checksum,
        rawJsonString: JSON.stringify(c.data)
      };
    });

    return {
      fixtureId,
      fixtureNaturalKey,
      competitionId,
      seasonId,
      homeTeamId,
      awayTeamId,
      kickoff,
      homeGoals,
      awayGoals,
      homeXg,
      awayXg,
      homeShots,
      awayShots,
      homeShotsOnTarget,
      awayShotsOnTarget,
      referee,
      regime,
      qualityScore: 100, // will be evaluated by QualityEngine
      schemaVersion: 1,
      datasetVersion: 6,
      lineage,
      generatedAt: new Date().toISOString()
    };
  }
}
