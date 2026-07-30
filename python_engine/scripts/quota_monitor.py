import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import quota_guard
from config import ODDSPAPI_MONTHLY_LIMIT

def run():
    print("--- QUOTA MONITOR ---")
    
    data = quota_guard._load_quota()
    odds_count = data.get("oddspapi", {}).get("count", 0)
    
    if odds_count > ODDSPAPI_MONTHLY_LIMIT * 0.8:
        print("ALERT: OddsPAPI monthly usage > 80%!")
        print("Action: Trigger Telegram Alert & Auto-drop to 1 snapshot/day.")
    else:
        print("Quota usage is healthy.")
        
    quota_guard.log_budget()
    print("--- MONITOR COMPLETE ---")

if __name__ == "__main__":
    run()
