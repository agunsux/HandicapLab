import { NextResponse } from 'next/server';
import { ExplanationRegistry } from '@/lib/explainability/ExplanationRegistry';
import { ExplanationFormatter } from '@/lib/explainability/ExplanationFormatter';
import { ExplanationFormat } from '@/lib/explainability/types';

/**
 * GET /api/explanations/[decisionId]
 * 
 * Retrieves a Decision Explanation.
 * Query Params:
 *  - format: 'json' (default), 'text', or 'markdown'
 */
export async function GET(
  req: Request,
  { params }: { params: { decisionId: string } }
) {
  try {
    const { decisionId } = params;
    const url = new URL(req.url);
    const format = (url.searchParams.get('format') || 'json') as ExplanationFormat;

    // In a real implementation, this would query the decision_explanations table.
    // For scaffolding, we use the in-memory registry.
    const explanation = ExplanationRegistry.get(decisionId);

    if (!explanation) {
      return NextResponse.json(
        { error: `Explanation not found for decisionId: ${decisionId}` },
        { status: 404 }
      );
    }

    if (format === 'json') {
      return NextResponse.json({
        decisionId,
        explanationObject: explanation, // structured is inside this
        narrative: explanation.narrative // duplicate reference for convenience
      });
    }

    // Text or Markdown formatting
    const formattedStr = ExplanationFormatter.format(explanation, format);
    return new NextResponse(formattedStr, {
      headers: {
        'Content-Type': format === 'markdown' ? 'text/markdown' : 'text/plain',
      },
    });
  } catch (err: any) {
    console.error('[explanations api] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
