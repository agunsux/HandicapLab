import { NextResponse } from 'next/server';
import { apiFootballClient } from '@/lib/apis/apifootball';
import { oddsApiClient } from '@/lib/apis/oddspapi';
import { LEAGUE_REGISTRY } from '@/lib/crons/leagueRegistry';

const SPORT_MAP: Record<number, string> = {
  39: 'soccer_epl',
  2: 'soccer_uefa_champs_league',
  3: 'soccer_uefa_europa_league',
  140: 'soccer_spain_la_liga',
  135: 'soccer_italy_serie_a',
  78: 'soccer_germany_bundesliga',
  61: 'soccer_france_ligue1',
  1: 'soccer_fifa_world_cup',
  844: 'soccer_uefa_europa_conference_league',
  848: 'soccer_france_ligue2'
};

export async function GET(request: Request) {
  try {
    const secret = request.headers.get('x-admin-secret');
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueParam = searchParams.get('league');

    const leagueConfigs = leagueParam 
      ? LEAGUE_REGISTRY.filter(l => String(l.apiFootballId) === leagueParam || l.id === leagueParam)
      : LEAGUE_REGISTRY.filter(l => l.enabled);

    if (leagueConfigs.length === 0) {
      return NextResponse.json({ error: 'No active matching competition config found.' }, { status: 404 });
    }

    const auditResults: any[] = [];

    for (const config of leagueConfigs) {
      const sportKey = SPORT_MAP[config.apiFootballId] || 'soccer_epl';
      let fixtures: any[] = [];
      let oddsList: any[] = [];

      // 1. Query API Football
      try {
        const res = await apiFootballClient.getFixtures(config.apiFootballId, 2026);
        fixtures = res.response || [];
      } catch (err: any) {
        // Suppress error details to protect provider info
      }

      // 2. Query The Odds API
      try {
        oddsList = await oddsApiClient.getOdds(sportKey);
      } catch (err: any) {
        // Suppress error details to protect provider info
      }

      // Map details
      const upcomingFixtures = fixtures.filter(f => {
        const kTime = new Date(f.fixture.date);
        return kTime > new Date() && f.fixture.status.short === 'NS';
      });

      const eventsAudit = upcomingFixtures.map(f => {
        const homeTeam = f.teams.home.name;
        const awayTeam = f.teams.away.name;
        
        // Find corresponding event in Odds API
        const matchOdds = oddsList.find(o => 
          o.home_team.toLowerCase().replace(/[\s-_]/g, '').includes(homeTeam.toLowerCase().replace(/[\s-_]/g, '')) ||
          homeTeam.toLowerCase().replace(/[\s-_]/g, '').includes(o.home_team.toLowerCase().replace(/[\s-_]/g, ''))
        );

        let bookmakerCount = 0;
        let sharpAvailable = false;
        let markets: string[] = [];

        if (matchOdds) {
          bookmakerCount = matchOdds.bookmakers?.length || 0;
          const pinnacle = matchOdds.bookmakers?.find((b: any) => b.key === 'pinnacle');
          sharpAvailable = !!pinnacle;
          
          if (pinnacle) {
            markets = pinnacle.markets?.map((m: any) => m.key) || [];
          }
        }

        return {
          teams: `${homeTeam} vs ${awayTeam}`,
          kickoff: f.fixture.date,
          oddsMatchFound: !!matchOdds,
          bookmakerCount,
          sharpAvailable,
          markets
        };
      });

      auditResults.push({
        competitionName: config.name,
        upcomingFixturesCount: upcomingFixtures.length,
        events: eventsAudit.slice(0, 10) // Show first 10 for readability
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      audit: auditResults
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
