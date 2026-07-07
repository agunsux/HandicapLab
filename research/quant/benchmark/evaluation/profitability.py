import pandas as pd
import numpy as np

def calculate_roi(df: pd.DataFrame, bet_size: float = 1.0) -> float:
    """
    Calculates the Return on Investment (ROI) of a strategy.
    Expects df to have:
    - 'bet_on': 0 (Home), 1 (Draw), 2 (Away), or NaN (No Bet)
    - 'result': 0 (Home), 1 (Draw), 2 (Away)
    - 'odds_home', 'odds_draw', 'odds_away'
    """
    if 'bet_on' not in df.columns or df['bet_on'].isna().all():
        return 0.0
        
    df_bets = df.dropna(subset=['bet_on']).copy()
    if df_bets.empty:
        return 0.0
        
    profit = 0.0
    total_staked = 0.0
    
    for _, row in df_bets.iterrows():
        bet = int(row['bet_on'])
        res = int(row['result'])
        
        odds_col = ['odds_home', 'odds_draw', 'odds_away'][bet]
        odds = row.get(odds_col, 1.0)
        
        total_staked += bet_size
        if bet == res:
            profit += (bet_size * odds) - bet_size
        else:
            profit -= bet_size
            
    return (profit / total_staked) * 100.0 if total_staked > 0 else 0.0

def calculate_yield(df: pd.DataFrame) -> float:
    return calculate_roi(df)
