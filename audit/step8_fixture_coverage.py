import httpx
import os

print("=" * 60)
print("FIXTURE COVERAGE CHECK")
print("=" * 60)

LEAGUES_TO_CHECK = [
    ('EPL', 'soccer_epl'),
    ('La Liga', 'soccer_spain_la_liga'),
    ('Serie A', 'soccer_italy_serie_a'),
    ('Bundesliga', 'soccer_germany_bundesliga'),
    ('Ligue 1', 'soccer_france_ligue_one'),
    ('Champions League', 'soccer_uefa_champs_league'),
    ('Eredivisie', 'soccer_netherlands_eredivisie'),
    ('Primeira Liga', 'soccer_portugal_primeira_liga'),
    ('Süper Lig', 'soccer_turkey_super_league'),
    ('Brasileirão', 'soccer_brazil_campeonato'),
]

api_key = os.getenv('THE_ODDS_API_KEY')
covered = []
not_covered = []

for league_name, sport_key in LEAGUES_TO_CHECK:
    try:
        resp = httpx.get(
            f'https://api.the-odds-api.com/v4/sports/{sport_key}/odds',
            params={'apiKey': api_key, 'regions': 'eu', 'markets': 'h2h'},
            timeout=10
        )
        if resp.status_code == 200:
            games = resp.json()
            if isinstance(games, list) and len(games) > 0:
                covered.append(f"{league_name}: {len(games)} fixtures")
            else:
                not_covered.append(f"{league_name}: 0 fixtures (off-season?)")
        else:
            not_covered.append(f"{league_name}: HTTP {resp.status_code}")
    except Exception as e:
        not_covered.append(f"{league_name}: Error - {str(e)[:50]}")

print(f"\n✅ LEAGUES WITH FIXTURES ({len(covered)}):")
for item in covered:
    print(f"  {item}")

print(f"\n❌ LEAGUES WITHOUT FIXTURES ({len(not_covered)}):")
for item in not_covered:
    print(f"  {item}")

print(f"\nCOVERAGE: {len(covered)}/{len(LEAGUES_TO_CHECK)} leagues active")
