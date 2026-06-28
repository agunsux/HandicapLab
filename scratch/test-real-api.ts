import { apiFootballClient } from '../src/lib/api/apiFootball';
import 'dotenv/config';

async function main() {
  console.log('Bypassing cache to fetch directly from API-Football...');
  const baseUrl = 'https://v3.football.api-sports.io';
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey || apiKey === 'mock') {
    console.log('No valid API key or in mock mode.');
    return;
  }
  
  const url = `${baseUrl}/fixtures?league=1&season=2026`;
  console.log(`Fetching from: ${url}`);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
      },
    });
    
    if (!res.ok) {
      console.error(`HTTP Error: ${res.status} ${res.statusText}`);
      return;
    }
    
    const data = await res.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error('API response errors:', data.errors);
      return;
    }
    
    console.log(`Fetched ${data.response?.length || 0} fixtures from real API.`);
    
    const rounds: Record<string, number> = {};
    data.response?.forEach((f: any) => {
      const round = f.league.round;
      rounds[round] = (rounds[round] || 0) + 1;
    });
    console.log('Rounds in real response:', rounds);
    
    // Print first 5 matches
    console.log('Sample of real matches:');
    console.log(data.response?.slice(0, 5).map((f: any) => ({
      id: f.fixture.id,
      round: f.league.round,
      home: f.teams.home.name,
      away: f.teams.away.name,
      date: f.fixture.date
    })));
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

main();
