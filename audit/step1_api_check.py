import os
import requests
from dotenv import load_dotenv
import time

load_dotenv('.env')

print("\n" + "=" * 60)
print("API STATUS:")
print("=" * 60)

# Check The Odds API
odds_api_key = os.getenv('THE_ODDS_API_KEY')
if odds_api_key:
    try:
        start_time = time.time()
        resp = requests.get('https://api.the-odds-api.com/v4/sports', params={'apiKey': odds_api_key}, timeout=5)
        latency = int((time.time() - start_time) * 1000)
        if resp.status_code == 200:
            remaining = resp.headers.get('x-requests-remaining', 'Unknown')
            print(f"- The Odds API: [OK] | Latency: {latency}ms | Remaining calls: {remaining}")
        else:
            print(f"- The Odds API: [FAIL] | HTTP {resp.status_code}")
    except Exception as e:
        print(f"- The Odds API: [FAIL] | Error: {e}")
else:
    print("- The Odds API: [FAIL] | Key missing")

# Check API-Football
api_football_key = os.getenv('API_FOOTBALL_KEY')
if api_football_key:
    try:
        start_time = time.time()
        headers = {'x-apisports-key': api_football_key}
        resp = requests.get('https://v3.football.api-sports.io/status', headers=headers, timeout=5)
        latency = int((time.time() - start_time) * 1000)
        if resp.status_code == 200:
            data = resp.json()
            requests_info = data.get('response', {}).get('requests', {})
            remaining = requests_info.get('limit_day', 0) - requests_info.get('current', 0)
            print(f"- API-Football: [OK] | Latency: {latency}ms | Remaining calls: {remaining}")
        else:
            print(f"- API-Football: [FAIL] | HTTP {resp.status_code}")
    except Exception as e:
        print(f"- API-Football: [FAIL] | Error: {e}")
else:
    print("- API-Football: [FAIL] | Key missing")

# Check FootyStats
footystats_key = os.getenv('FOOTYSTATS_API_KEY')
if footystats_key:
    print("- FootyStats: [OK] | Note: Need specific endpoint to test properly")
else:
    print("- FootyStats: [FAIL] | Key missing")
