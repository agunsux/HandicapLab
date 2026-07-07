import yaml
from pathlib import Path
import pandas as pd
import warnings
from typing import Dict, List, Tuple

class CrossProviderConflictError(Exception):
    pass

class CanonicalMerger:
    def __init__(self, config_path: str = None):
        if not config_path:
            config_path = Path(__file__).parent / "trusted_providers.yaml"
            
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)
            
        self.audit_log = []
        
    def _get_provider_priority(self, field_group: str, competition: str = None) -> List[str]:
        # Check competition specific override
        if competition and 'competitions' in self.config and competition in self.config['competitions']:
            if field_group in self.config['competitions'][competition]:
                return self.config['competitions'][competition][field_group]
        
        # Fallback to default
        if field_group in self.config['default']:
            return self.config['default'][field_group]
            
        return []

    def _resolve_conflict(self, match_uuid: str, field_name: str, values_by_provider: Dict[str, any], priority_list: List[str], severity: str):
        """
        Resolves conflicts based on Severity Tier and Trusted Providers.
        """
        unique_values = set(v for v in values_by_provider.values() if pd.notnull(v))
        if len(unique_values) <= 1:
            # No real conflict, just take the first non-null
            return list(unique_values)[0] if unique_values else None
            
        if severity == 'CRITICAL':
            raise CrossProviderConflictError(f"[CRITICAL] Match {match_uuid}: Conflict on {field_name}. Values: {values_by_provider}")
            
        if severity == 'ERROR':
            self.audit_log.append({
                "severity": "ERROR",
                "match_uuid": match_uuid,
                "field": field_name,
                "values": values_by_provider,
                "action": "QUARANTINE"
            })
            return None # We return None or special flag to quarantine
            
        # WARNING or INFO -> Auto resolve using Trusted Provider
        chosen_value = None
        chosen_provider = None
        for prov in priority_list:
            if prov in values_by_provider and pd.notnull(values_by_provider[prov]):
                chosen_value = values_by_provider[prov]
                chosen_provider = prov
                break
                
        if not chosen_provider:
            # Fallback to just the first available
            chosen_provider, chosen_value = list(values_by_provider.items())[0]
            
        if severity == 'WARNING':
            self.audit_log.append({
                "severity": "WARNING",
                "match_uuid": match_uuid,
                "field": field_name,
                "values": values_by_provider,
                "action": "AUTO_RESOLVE",
                "chosen_provider": chosen_provider
            })
            
        return chosen_value

    def merge_providers(self, dataframes: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """
        Accepts a dict of {provider_id: dataframe}.
        Returns a single merged canonical dataframe.
        """
        if not dataframes:
            return pd.DataFrame()
            
        if len(dataframes) == 1:
            # Only one provider, no conflict possible
            return list(dataframes.values())[0]
            
        # 1. Concat all records
        all_records = pd.concat([df.assign(provider=p) for p, df in dataframes.items()], ignore_index=True)
        
        # 2. Group by match_uuid
        merged_rows = []
        
        for uuid, group in all_records.groupby('match_uuid'):
            league_id = group['league_id'].iloc[0]
            
            providers_present = group['provider'].tolist()
            merged_row = {"match_uuid": uuid}
            
            # TIER 1: CRITICAL (Results)
            result_priority = self._get_provider_priority('result', league_id)
            for f in ['home_goals_ft', 'away_goals_ft', 'status']:
                if f in group.columns:
                    vals = group.set_index('provider')[f].to_dict()
                    merged_row[f] = self._resolve_conflict(uuid, f, vals, result_priority, 'CRITICAL')
                    
            # TIER 2: WARNING (Stats)
            stats_priority = self._get_provider_priority('stats', league_id)
            stat_cols = [c for c in group.columns if 'corners' in c or 'shots' in c or 'possession' in c or 'xg' in c]
            for f in stat_cols:
                vals = group.set_index('provider')[f].to_dict()
                merged_row[f] = self._resolve_conflict(uuid, f, vals, stats_priority, 'WARNING')
                
            # Other fields (e.g. odds) just take default priority
            odds_priority = self._get_provider_priority('odds', league_id)
            odd_cols = [c for c in group.columns if c.startswith('odds_')]
            for f in odd_cols:
                vals = group.set_index('provider')[f].to_dict()
                merged_row[f] = self._resolve_conflict(uuid, f, vals, odds_priority, 'INFO')
                
            # Basic info (Date, Teams, etc) - Assume critical or handled by UUID
            for f in ['league_id', 'season', 'home_team_id', 'away_team_id', 'date']:
                if f in group.columns:
                    vals = group.set_index('provider')[f].to_dict()
                    merged_row[f] = self._resolve_conflict(uuid, f, vals, result_priority, 'CRITICAL')
                    
            merged_rows.append(merged_row)
            
        return pd.DataFrame(merged_rows)
