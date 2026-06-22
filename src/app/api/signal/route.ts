import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Market, Status } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { match, market, selection, odds, timestamp, confidence, expectedValue } = body;

    if (!match || !match.homeTeam || !match.awayTeam || !match.league || !match.startTime) {
      return NextResponse.json({ error: 'Invalid match data' }, { status: 400 });
    }
    if (!market || !selection || !odds || !timestamp || confidence === undefined || expectedValue === undefined) {
      return NextResponse.json({ error: 'Invalid signal data' }, { status: 400 });
    }

    // Upsert Match
    const dbMatch = await prisma.match.create({
      data: {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        startTime: new Date(match.startTime),
      }
    }); // Actually, if we want to reuse matches, we should try to find it first.
    // For MVP simplicity, let's just create a new match or assume match is passed by ID. 
    // Wait, the schema uses UUID for match. Let's create the match if we pass match object.
    
    const dbSignal = await prisma.signal.create({
      data: {
        matchId: dbMatch.id,
        market: market as Market,
        selection,
        odds: parseFloat(odds),
        timestamp: new Date(timestamp),
        confidence: parseFloat(confidence),
        expectedValue: parseFloat(expectedValue),
        status: Status.OPEN,
      }
    });

    return NextResponse.json(dbSignal, { status: 201 });
  } catch (error) {
    console.error('Error creating signal:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
