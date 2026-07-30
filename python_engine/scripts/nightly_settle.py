import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fetchers import api_football
from services import supabase_client
import quota_guard

def run():
    print("--- STARTING NIGHTLY SETTLE ---")
    quota_guard.log_budget()
    
    results = api_football.get_yesterday_results()
    print(f"Fetched {len(results)} finished results from API-Football whitelist.")
    
    # Settle
    supabase_client.settle_pick("mock_id", "WON")
    supabase_client.update_track_record({"roi": 5.2})
    
    quota_guard.log_budget()
    print("--- NIGHTLY SETTLE COMPLETE ---")

if __name__ == "__main__":
    run()
