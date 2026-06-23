import { NextResponse } from 'next/server';
import { generatePredictions } from '../../../lib/services/predictionService';
import { fetchUpcomingFixtures } from '../../../lib/api/apiFootball';

export async function GET() {
  try {
    // Fetch upcoming fixtures from API-Football
    const fixtures = await fetchUpcomingFixtures();
    
    // Generate predictions using Poisson engine
    const predictions = await generatePredictions(fixtures);
    
    // Format response
    const response = predictions.map(pred => ({
      match: `${pred.homeTeam} vs ${pred.awayTeam}`,
      kickoff: pred.kickoffTime,
      league: pred.league,
      
      prediction: {
        home: Math.round(pred.homeWinProb * 100),
        draw: Math.round(pred.drawProb * 100),
        away: Math.round(pred.awayWinProb * 100),
      },
      
      asianHandicap: {
        line: `${pred.homeTeam} ${pred.ahLine > 0 ? '+' : ''}${pred.ahLine}`,
        confidence: Math.round(pred.ahHomeProb * 100),
      },
      
      overUnder: {
        line: `O/U ${pred.ouLine}`,
        over: Math.round(pred.overProb * 100),
        under: Math.round(pred.underProb * 100),
      },
      
      confidence: pred.confidenceLevel,
    }));

    return NextResponse.json({ success: true, predictions: response });
  } catch (error: any) {
    console.error('Predictions API Route Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
