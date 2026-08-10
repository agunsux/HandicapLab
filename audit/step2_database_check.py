import os
from supabase import create_client

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_KEY')  # Use SERVICE_ROLE_KEY for full access
client = create_client(url, key)

TABLES_TO_CHECK = [
    'teams',
    'matches',
    'signals',
    'public_ledger',
    'predictions',
    'user_signal_actions',
]

print("=" * 60)
print("SUPABASE DATABASE STATE CHECK")
print("=" * 60)

for table in TABLES_TO_CHECK:
    try:
        response = client.table(table).select('*', count='exact').limit(1).execute()
        count = response.count if hasattr(response, 'count') else len(response.data)
        
        # Get latest record if exists
        latest = None
        if count > 0:
            latest_resp = client.table(table).select('*').order(
                'created_at', desc=True
            ).limit(1).execute()
            if latest_resp.data:
                latest = latest_resp.data[0].get('created_at', 'N/A')
        
        status = '✅ HAS DATA' if count > 0 else '❌ EMPTY'
        print(f"\n[{status}] Table: {table}")
        print(f"  Row count: {count}")
        print(f"  Latest record: {latest}")
        
    except Exception as e:
        print(f"\n[❌ ERROR] Table: {table}")
        print(f"  Error: {str(e)}")

# Check if Realtime is enabled
print("\n" + "=" * 60)
print("REALTIME STATUS:")
print("  Check Supabase Dashboard → Settings → Replication")
print("  Required: signals, public_ledger must have Realtime ON")
print("=" * 60)
