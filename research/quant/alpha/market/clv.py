from dataclasses import dataclass
from typing import List, Optional
import datetime

@dataclass
class OddsSnapshot:
    timestamp: datetime.datetime
    home_odds: float
    draw_odds: float
    away_odds: float
    event_type: str # 'opening', 'update', 'closing'

@dataclass
class CLVEvaluation:
    match_id: str
    prediction_time: datetime.datetime
    odds_at_prediction: float
    closing_odds: float
    clv_value: float
    bookmaker: str

class EventDrivenCLVEngine:
    """
    Evaluates Closing Line Value by taking an event stream of OddsSnapshots.
    """
    
    def __init__(self):
        self.snapshots = [] # History of snapshots
        
    def ingest_snapshot(self, snapshot: OddsSnapshot):
        """
        Receives an odds update from the market.
        """
        self.snapshots.append(snapshot)
        
    def _remove_vig(self, home: float, draw: float, away: float) -> tuple:
        """
        Removes the bookmaker margin (vig) proportionally to find true implied probabilities.
        """
        if home <= 0 or draw <= 0 or away <= 0:
            return 0.0, 0.0, 0.0
            
        implied_home = 1.0 / home
        implied_draw = 1.0 / draw
        implied_away = 1.0 / away
        
        total_implied = implied_home + implied_draw + implied_away
        
        true_home = implied_home / total_implied
        true_draw = implied_draw / total_implied
        true_away = implied_away / total_implied
        
        return true_home, true_draw, true_away

    def evaluate_clv(self, match_id: str, prediction_odds: float, bet_selection: str, bookmaker: str) -> Optional[CLVEvaluation]:
        """
        Calculates CLV using the final 'closing' snapshot.
        CLV Formula used here: (Prediction Odds / True Closing Odds) - 1.0
        """
        closing_snapshots = [s for s in self.snapshots if s.event_type == 'closing']
        if not closing_snapshots:
            return None
            
        # Get the latest closing snapshot
        closing = sorted(closing_snapshots, key=lambda x: x.timestamp)[-1]
        
        true_home, true_draw, true_away = self._remove_vig(closing.home_odds, closing.draw_odds, closing.away_odds)
        
        true_prob = 0.0
        if bet_selection == 'home':
            true_prob = true_home
        elif bet_selection == 'draw':
            true_prob = true_draw
        elif bet_selection == 'away':
            true_prob = true_away
            
        if true_prob == 0.0:
            return None
            
        true_odds = 1.0 / true_prob
        
        # Calculate CLV: How much better are our odds compared to the true closing odds?
        clv = (prediction_odds / true_odds) - 1.0
        
        return CLVEvaluation(
            match_id=match_id,
            prediction_time=datetime.datetime.now(), # In real scenario, passed as arg
            odds_at_prediction=prediction_odds,
            closing_odds=closing.home_odds if bet_selection == 'home' else (closing.draw_odds if bet_selection == 'draw' else closing.away_odds),
            clv_value=clv,
            bookmaker=bookmaker
        )
