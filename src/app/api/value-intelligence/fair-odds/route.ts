import { NextRequest, NextResponse } from 'next/server';
import { computeFairOdds } from '../../../../lib/value-intelligence/fair-odds-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quote, selection, modelProb } = body;

    if (!quote || !selection || modelProb === undefined) {
      return NextResponse.json({ error: 'Missing required parameters: quote, selection, modelProb' }, { status: 400 });
    }

    const result = computeFairOdds(quote, selection, modelProb);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
