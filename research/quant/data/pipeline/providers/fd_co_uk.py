import pandas as pd
from pathlib import Path
import urllib.request
import time
from .base import ProviderInterface

class FootballDataCoUkProvider(ProviderInterface):
    @property
    def provider_id(self) -> str:
        return "football_data_co_uk"
        
    def __init__(self):
        # We will focus on 2016-2023 for Top 5 Leagues
        # E0 = EPL, SP1 = LaLiga, I1 = Serie A, D1 = Bundesliga, F1 = Ligue 1
        self.leagues = ['E0', 'E1', 'E2', 'E3', 'SP1', 'SP2', 'I1', 'I2', 'D1', 'D2', 'F1', 'F2', 'N1', 'P1', 'B1', 'SC0', 'T1']
        
        self.seasons = []
        for year in range(10, 24):
            y1 = str(year).zfill(2)
            y2 = str(year + 1).zfill(2)
            self.seasons.append(f"{y1}{y2}")
        self.base_url = "https://www.football-data.co.uk/mmz4281"
        
    def download_raw(self, output_dir: str):
        out_path = Path(output_dir) / self.provider_id
        out_path.mkdir(parents=True, exist_ok=True)
        
        for season in self.seasons:
            for league in self.leagues:
                url = f"{self.base_url}/{season}/{league}.csv"
                file_path = out_path / f"{season}" / f"{league}_{season}_v1.csv"
                
                if file_path.exists():
                    continue
                    
                file_path.parent.mkdir(parents=True, exist_ok=True)
                
                try:
                    df = pd.read_csv(url)
                    df.to_csv(file_path, index=False)
                    print(f"Downloaded {league} {season}")
                    time.sleep(1) # Rate limit
                except Exception as e:
                    print(f"Failed to download {league} {season} - {e}")
                    
    def parse_to_raw_dataframe(self, raw_dir: str) -> pd.DataFrame:
        in_path = Path(raw_dir) / self.provider_id
        all_dfs = []
        
        for file in in_path.rglob("*.csv"):
            try:
                # football-data sometimes has trailing commas or bad lines
                df = pd.read_csv(file, on_bad_lines='skip', encoding='latin1')
                # Inject metadata
                df['fd_league_file'] = file.stem.split('_')[0]
                df['fd_season_file'] = file.stem.split('_')[1]
                all_dfs.append(df)
            except Exception as e:
                print(f"Error parsing {file}: {e}")
                
        if not all_dfs:
            return pd.DataFrame()
            
        full_df = pd.concat(all_dfs, ignore_index=True)
        return full_df
