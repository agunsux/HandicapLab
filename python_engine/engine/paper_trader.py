from services import supabase_client
import uuid

def execute_paper_trade(pick):
    if pick["verdict"] not in ["LAYAK", "PANTAU"]:
        return None
        
    bankroll_pct = 2.0  # flat 2% bankroll
    
    trade = {
        "signal_id": str(uuid.uuid4()),
        "match": f"{pick.get('home_team', 'Home')} vs {pick.get('away_team', 'Away')}",
        "prediction": pick.get("pick", ""),
        "odds": pick["market_odds"],
        "edge": pick["edge_pct"],
        "confidence": pick["confidence"],
        "result": "PENDING"
    }
    
    # Normally we would save to public_ledger in supabase
    # supabase_client.upsert_public_ledger(trade)
    print(f"Executed Paper Trade: {trade['match']} | Bet: {trade['prediction']} | Odds: {trade['odds']}")
    return trade
