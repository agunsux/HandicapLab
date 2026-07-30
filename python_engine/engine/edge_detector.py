from config import MIN_EDGE_PCT

def form_bonus(val):
    # Mock return 0-15
    return min(15, val)
    
def sample_bonus(val):
    # Mock return 0-10
    return min(10, val)

def detect_edge(market_type, bookmaker, market_odds, model_prob, fair_odds):
    edge_pct = ((market_odds / fair_odds) - 1) * 100
    edge_pct = round(edge_pct, 2)
    
    confidence = 0
    reasoning = ""
    
    if edge_pct >= MIN_EDGE_PCT:
        confidence_raw = 50 + (edge_pct * 5) + form_bonus(10) + sample_bonus(5)
        confidence = min(95, confidence_raw)
        
        prob_pct = int(model_prob * 100)
        market_implied = int((1 / market_odds) * 100) if market_odds > 0 else 0
        
        reasoning = f"Model: {prob_pct}% menang. Odds {bookmaker.upper()} {market_odds} = {market_implied}%. Unggul +{edge_pct}%."
        
    return {
        "market_type": market_type,
        "bookmaker": bookmaker,
        "market_odds": market_odds,
        "model_prob": model_prob,
        "fair_odds": fair_odds,
        "edge_pct": edge_pct,
        "confidence": round(confidence, 1),
        "reasoning": reasoning
    }
