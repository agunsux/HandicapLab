import os
from datetime import datetime, timedelta
from supabase import create_client

client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))

print("=" * 60)
print("HISTORICAL DATA CHECK")
print("=" * 60)

one_week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
one_month_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()

try:
    total = client.table('matches').select('*', count='exact').execute()
    total_count = total.count if hasattr(total, 'count') else 0
    
    recent = client.table('matches').select('*', count='exact').gte('fixture_date', one_week_ago).execute()
    recent_count = recent.count if hasattr(recent, 'count') else 0
    
    monthly = client.table('matches').select('*', count='exact').gte('fixture_date', one_month_ago).execute()
    monthly_count = monthly.count if hasattr(monthly, 'count') else 0
    
    settled = client.table('matches').select('*', count='exact').neq('status', 'SCHEDULED').execute()
    settled_count = settled.count if hasattr(settled, 'count') else 0
    
    upcoming = client.table('matches').select('*', count='exact').gte('fixture_date', datetime.utcnow().isoformat()).execute()
    upcoming_count = upcoming.count if hasattr(upcoming, 'count') else 0
    
    print(f"\nTotal matches in DB: {total_count}")
    print(f"Last 7 days: {recent_count}")
    print(f"Last 30 days: {monthly_count}")
    print(f"Settled (has result): {settled_count}")
    print(f"Upcoming fixtures: {upcoming_count}")
    
    if total_count == 0:
        print("\n❌ NO HISTORICAL DATA INGESTED")
        print("   Action needed: Run data fetch script")
    elif settled_count == 0:
        print("\n⚠️ Data exists but NO SETTLED MATCHES")
        print("   Cannot backtest or calculate ROI yet")
    else:
        print(f"\n✅ HISTORICAL DATA PRESENT ({settled_count} settled matches)")
        
    if upcoming_count > 0:
        print(f"✅ UPCOMING FIXTURES DETECTED ({upcoming_count} matches)")
    else:
        print("❌ NO UPCOMING FIXTURES LOADED")
        print("   Action needed: Fetch next 7-14 days of fixtures")
        
except Exception as e:
    print(f"\n❌ ERROR checking historical data: {e}")
