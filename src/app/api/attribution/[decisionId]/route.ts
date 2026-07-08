import { NextResponse } from 'next/server';
import { AttributionEngine } from '@/lib/attribution/AttributionEngine';
import { ExplanationRegistry } from '@/lib/explainability/ExplanationRegistry';

/**
 * GET /api/attribution/[decisionId]
 * 
 * Retrieves the full Attribution analysis for a decision.
 * Note: In a real implementation, this would fetch from `decision_attributions`.
 * Here we scaffold it by computing on the fly from the ExplanationRegistry mock.
 */
export async function GET(
  req: Request,
  { params }: { params: { decisionId: string } }
) {
  try {
    const { decisionId } = params;
    
    // For scaffolding, we pull the M4 explanation from memory.
    // In production, we'd query `decision_attributions` table directly.
    const explanation = ExplanationRegistry.get(decisionId);

    if (!explanation) {
      return NextResponse.json(
        { error: `Explanation (and thus Attribution) not found for decisionId: ${decisionId}` },
        { status: 404 }
      );
    }

    // Scaffolded on-the-fly execution. (In prod, this is pre-computed and stored).
    // We mock the DecisionObject dependencies since we only have the ExplanationObject in memory.
    const mockDecisionObject: any = {
      decision_version: explanation.decisionSchemaVersion,
      decision: 'BET',
      confidence: 0.8,
      blocking_flags: explanation.structured.dominantRisks.map(r => r.flag),
      uncertainty_vector: { epistemic: 0.2 }
    };

    const attribution = AttributionEngine.buildDraft({
      decisionId,
      decisionObject: mockDecisionObject,
      explanationObject: explanation
    });

    return NextResponse.json({
      decisionId,
      phase: attribution.phase,
      qualityScore: attribution.qualityScore,
      decisionDNA: attribution.decisionDNA,
      attribution
    });
  } catch (err: any) {
    console.error('[attribution api] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
