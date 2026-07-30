from config import MIN_CONFIDENCE

def generate_pick(edges):
    # Filter confidence >= MIN_CONFIDENCE
    valid_edges = [e for e in edges if e["confidence"] >= MIN_CONFIDENCE]
    
    if not valid_edges:
        return None
        
    # ONE pick per match (highest edge)
    best_edge = max(valid_edges, key=lambda e: e["edge_pct"])
    
    edge = best_edge["edge_pct"]
    conf = best_edge["confidence"]
    
    if edge >= 5 and conf >= 80:
        verdict = "LAYAK"
    elif edge >= 3 and conf >= 70:
        verdict = "PANTAU"
    else:
        verdict = "LEWATI"
        
    best_edge["verdict"] = verdict
    return best_edge
