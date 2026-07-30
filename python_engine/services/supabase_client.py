import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")

if url and key and url != "mock" and key != "mock":
    supabase: Client = create_client(url, key)
else:
    supabase = None

def upsert_daily_picks(picks):
    if not supabase:
        print("Mock: Upserting picks to DB...", len(picks))
        return
    
    # Standard supabase upsert
    pass

def save_odds_snapshot(snapshot):
    if not supabase:
        print("Mock: Saving odds snapshot...")
        return
    pass

def settle_pick(pick_id, result):
    if not supabase:
        print(f"Mock: Settling pick {pick_id} with result {result}")
        return
    pass

def update_track_record(stats):
    if not supabase:
        print("Mock: Updating track record...")
        return
    pass
