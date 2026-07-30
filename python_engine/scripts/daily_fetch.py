import sys
import os

# Add parent dir to path to import correctly when run as script
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fetchers import api_football, oddspapi
from models.dixon_coles import DixonColesModel
from engine import edge_detector, pick_generator
from services import supabase_client
import quota_guard

def run():
    print("--- STARTING DAILY FETCH ---")
    quota_guard.log_budget()
    
    # 1. Get Fixtures
    fixtures = api_football.get_todays_fixtures()
    print(f"Fetched {len(fixtures)} fixtures from API-Football whitelist.")
    
    # 2. Get Opening Odds
    odds = oddspapi.get_all_odds("opening")
    print(f"Fetched odds for {len(odds)} leagues from OddsPAPI.")
    
    # 3. Model
    model = DixonColesModel()
    model.fit([]) # Mock fit
    
    picks_to_save = []
    
    # Wrap in try/except for resilience
    try:
        # Mock match process
        home_team = "Arsenal"
        away_team = "Chelsea"
        
        preds = model.predict(home_team, away_team)
        
        # Mock edge detection
        edges = []
        
        # Test ML
        market_odds_ml = 2.25
        model_prob_ml = preds["p_home_win"]
        fair_ml = model.fair_odds(model_prob_ml)
        edge = edge_detector.detect_edge("MONEYLINE", "sbo", market_odds_ml, model_prob_ml, fair_ml)
        print("DEBUG EDGE:", edge)
        if edge["edge_pct"] > 0:
            edges.append(edge)
            
        pick = pick_generator.generate_pick(edges)
        print("DEBUG PICK:", pick)
        if pick:
            print(f"Generated Pick: {pick}")
            picks_to_save.append(pick)
            
    except Exception as e:
        print(f"Failed to process match: {e}")
        
    # 4. Save
    supabase_client.upsert_daily_picks(picks_to_save)
    
    quota_guard.log_budget()
    print("--- DAILY FETCH COMPLETE ---")

if __name__ == "__main__":
    run()
