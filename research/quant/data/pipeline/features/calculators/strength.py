import pandas as pd
import numpy as np
from ..base import BaseFeatureGenerator, temporal_guard

class EloRating(BaseFeatureGenerator):
    feature_name = 'elo_rating'
    
    def __init__(self, k_factor=20, home_adv=100, initial_rating=1500):
        super().__init__()
        self.k = k_factor
        self.home_adv = home_adv
        self.initial_rating = initial_rating
        
    @temporal_guard
    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculates pre-match ELO ratings for Home and Away teams.
        Returns DataFrame with 'home_elo_pre' and 'away_elo_pre'.
        """
        # Ensure chronological order
        df = df.sort_values('date').copy()
        
        ratings = {}
        home_elo_pre = []
        away_elo_pre = []
        
        for idx, row in df.iterrows():
            home = row['home_team_id']
            away = row['away_team_id']
            
            # Fetch current rating (PRE-MATCH)
            r_home = ratings.get(home, self.initial_rating)
            r_away = ratings.get(away, self.initial_rating)
            
            home_elo_pre.append(r_home)
            away_elo_pre.append(r_away)
            
            # Post-match update
            if 'home_goals_ft' in row and pd.notnull(row['home_goals_ft']):
                hg = row['home_goals_ft']
                ag = row['away_goals_ft']
                
                # Match result
                if hg > ag:
                    s_home, s_away = 1.0, 0.0
                elif hg < ag:
                    s_home, s_away = 0.0, 1.0
                else:
                    s_home, s_away = 0.5, 0.5
                    
                # Expected score
                dr = (r_home + self.home_adv) - r_away
                e_home = 1 / (1 + 10 ** (-dr / 400))
                e_away = 1 - e_home
                
                # Update (POST-MATCH)
                ratings[home] = r_home + self.k * (s_home - e_home)
                ratings[away] = r_away + self.k * (s_away - e_away)
                
        df['home_elo_pre'] = home_elo_pre
        df['away_elo_pre'] = away_elo_pre
        
        # Return only the generated features as expected by orchestrator
        return df[['home_elo_pre', 'away_elo_pre']]

class RollingPoints(BaseFeatureGenerator):
    feature_name = 'rolling_points'
    
    @temporal_guard
    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.sort_values('date').copy()
        
        # Melt to Team-Match level
        home = df[['match_uuid', 'date', 'home_team_id', 'home_goals_ft', 'away_goals_ft']].rename(
            columns={'home_team_id': 'team_id', 'home_goals_ft': 'gf', 'away_goals_ft': 'ga'}
        )
        home['is_home'] = 1
        
        away = df[['match_uuid', 'date', 'away_team_id', 'away_goals_ft', 'home_goals_ft']].rename(
            columns={'away_team_id': 'team_id', 'away_goals_ft': 'gf', 'home_goals_ft': 'ga'}
        )
        away['is_home'] = 0
        
        melted = pd.concat([home, away]).sort_values('date')
        
        # Calculate points
        conditions = [
            melted['gf'] > melted['ga'],
            melted['gf'] == melted['ga'],
            melted['gf'] < melted['ga']
        ]
        choices = [3, 1, 0]
        melted['pts'] = np.select(conditions, choices, default=np.nan)
        
        # Rolling sum of points (LAG 1 -> Pre-match)
        # Shift 1 ensures we only look at past matches, grouped by team
        melted['rolling_pts_5'] = melted.groupby('team_id')['pts'].transform(
            lambda x: x.shift(1).rolling(5, min_periods=1).sum()
        )
        
        # Re-pivot to match_uuid
        # This gives us the pre-match rolling points for both teams
        home_feats = melted[melted['is_home'] == 1].set_index('match_uuid')[['rolling_pts_5']].rename(columns={'rolling_pts_5': 'home_rolling_pts_5'})
        away_feats = melted[melted['is_home'] == 0].set_index('match_uuid')[['rolling_pts_5']].rename(columns={'rolling_pts_5': 'away_rolling_pts_5'})
        
        # Merge back to original index
        result = df[['match_uuid']].merge(home_feats, on='match_uuid', how='left')
        result = result.merge(away_feats, on='match_uuid', how='left')
        
        return result.set_index(df.index)[['home_rolling_pts_5', 'away_rolling_pts_5']]
