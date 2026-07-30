import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fetchers import oddspapi
from services import supabase_client
import quota_guard

def run():
    print("--- STARTING CLOSING SNAPSHOT ---")
    quota_guard.log_budget()
    
    odds = oddspapi.get_all_odds("closing")
    print(f"Fetched closing odds for {len(odds)} leagues from OddsPAPI.")
    
    # Normally we match to picks and save snapshots
    supabase_client.save_odds_snapshot({"mock": "data"})
    
    quota_guard.log_budget()
    print("--- CLOSING SNAPSHOT COMPLETE ---")

if __name__ == "__main__":
    run()
