import json, csv, os
from collections import Counter

SEASONS = ["2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020", "2020-2021", "2021-2022", "2022-2023", "2023-2024"]

for s in SEASONS:
    try:
        csv_data = list(csv.DictReader(open(f"data/bronze/football_data/{s}.csv", encoding="latin1")))
    except:
        csv_data = []
    
    try:
        understat_data = json.load(open(f"data/bronze/EPL/{s}_understat.json"))
    except:
        understat_data = []
        
    print(f"\\nSeason: {s}")
    print(f"CSV Matches: {len(csv_data)}")
    print(f"Understat Matches: {len(understat_data)}")
    
    if understat_data:
        home_teams = Counter(d['homeTeamId'] for d in understat_data)
        away_teams = Counter(d['awayTeamId'] for d in understat_data)
        all_teams = set(home_teams.keys()).union(set(away_teams.keys()))
        print(f"Understat Unique Teams: {len(all_teams)}")
        print(f"Understat Home Matches: {sum(home_teams.values())}, Away: {sum(away_teams.values())}")
