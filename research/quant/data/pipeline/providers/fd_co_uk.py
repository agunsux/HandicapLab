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
        self.leagues = ["E0", "SP1", "I1", "D1", "F1"]
        # Seasons like "1617", "1718", ..., "2324"
        self.seasons = [f"{str(y).zfill(2)}{str(y+1).zfill(2)}" for y in range(16, 24)]
        self.base_url = "https://www.football-data.co.uk/mmz4281/{}/{}.csv"
        
    def download_raw(self, output_dir: str):
        out_path = Path(output_dir) / self.provider_id
        out_path.mkdir(parents=True, exist_ok=True)
        
        for season in self.seasons:
            for league in self.leagues:
                url = self.base_url.format(season, league)
                target_file = out_path / f"{league}_{season}.csv"
                
                if target_file.exists():
                    print(f"Skipping {league} {season}, already downloaded.")
                    continue
                    
                print(f"Downloading {url} ...")
                try:
                    # Added a dummy header since some servers block vanilla python urllib
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req) as response, open(target_file, 'wb') as out_file:
                        out_file.write(response.read())
                    time.sleep(1) # Be polite
                except Exception as e:
                    print(f"Failed to download {url}: {e}")
                    
    def parse_to_raw_dataframe(self, raw_dir: str) -> pd.DataFrame:
        in_path = Path(raw_dir) / self.provider_id
        all_dfs = []
        
        for file in in_path.glob("*.csv"):
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
