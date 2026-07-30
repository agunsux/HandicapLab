import quota_guard
from cache import local_cache

def run_test():
    print("--- DRY RUN: STEP 1 FOUNDATION ---")
    
    # 1. Test Quota Guard
    print("\n[Testing Quota Guard]")
    quota_guard.log_budget()
    
    print("Incrementing api_football...")
    quota_guard.increment("api_football")
    quota_guard.check("api_football")
    
    print("Incrementing oddspapi...")
    quota_guard.increment("oddspapi")
    quota_guard.check("oddspapi")
    
    quota_guard.log_budget()
    
    # 2. Test Cache
    print("\n[Testing Local Cache]")
    test_key = "test_fixture_123"
    test_data = {"home": "Arsenal", "away": "Chelsea"}
    
    print("Setting cache...")
    local_cache.set(test_key, test_data)
    
    print("Getting cache...")
    retrieved = local_cache.get(test_key, ttl_seconds=60)
    print(f"Retrieved: {retrieved}")
    
    assert retrieved == test_data, "Cache retrieval failed or data mismatch"
    
    print("\nSTEP 1 COMPLETE")

if __name__ == "__main__":
    run_test()
