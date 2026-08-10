import sys
sys.path.insert(0, '.')

try:
    from python_engine.engine.pick_generator import PickGenerator
    # The snippet used SignalGenerator but it seems like we might not have it. Let's look up how to actually import SignalGenerator or similar.
    from engines.signal_generator import SignalGenerator
    generator = SignalGenerator()
    
    # Simulate a match with market odds
    signals = generator.generate_signals(
        match_id="AUDIT_TEST_001",
        home_team="Liverpool",
        away_team="Arsenal",
        match_minute=67,
        score_home=1,
        score_away=0,
        possession_home=70,
        shots_on_target_home=12,
        shots_on_target_away=1,
        xg_home=1.4,
        xg_away=0.3,
        market_odds={
            'over_2_5': 1.85,
            'ah_home_075': 1.90,
        }
    )
    
    print("=" * 60)
    print("SIGNAL GENERATION TEST")
    print("=" * 60)
    print(f"Signals generated: {len(signals)}")
    
    if signals:
        for i, sig in enumerate(signals):
            print(f"\n  Signal {i+1}:")
            print(f"    Market: {sig.market_type}")
            print(f"    Prediction: {sig.prediction}")
            print(f"    Edge: {sig.edge_percentage:+.1f}%")
            print(f"    Confidence: {sig.confidence_score}/100")
            print(f"    Entry window: {sig.entry_window_start}'-{sig.entry_window_end}'")
        print(f"\n✅ SIGNAL PIPELINE ALIVE")
    else:
        print("\n⚠️ NO SIGNALS GENERATED")
        print("   Possible reasons:")
        print("   - Edge below threshold (< 3%)")
        print("   - Match minute < 55 (first half filter)")
        print("   - Market odds not triggering value")
        print("   This is NORMAL if no value exists in test data.")
        
except ImportError as e:
    print(f"❌ SignalGenerator module not found: {e}")
except Exception as e:
    print(f"❌ SIGNAL PIPELINE ERROR: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
