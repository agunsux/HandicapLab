"""
engine/backtester.py — Walk-forward backtest engine (NO LOOKAHEAD).
For each league independently:
  1. Sort by date ascending
  2. Skip first 80 matches (insufficient training data)
  3. Expanding window: train only on matches BEFORE current match
  4. Retrain every 40 matches (checkpoint), cache params between
  5. Apply EXACT same edge/pick logic as live pipeline
  6. Settle with settlement.py, compute CLV from Pinnacle closing odds
"""
import sys
import os
import hashlib
from typing import List, Dict, Any, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.dixon_coles import DixonColesModel
from engine.settlement import settle_ml, settle_ou, settle_ah, calc_pnl, win_count
from config import MIN_EDGE_PCT, MIN_CONFIDENCE


SKIP_FIRST_N = 80       # minimum training matches per league
RETRAIN_EVERY = 40       # retrain checkpoint interval


def _form_bonus(match_idx: int, total_in_league: int) -> float:
    """Simple form bonus: more history = more confidence (0-15)."""
    if total_in_league > 200:
        return 12
    elif total_in_league > 100:
        return 8
    return 4


def _sample_bonus(training_size: int) -> float:
    """Sample size bonus (0-10)."""
    if training_size > 300:
        return 8
    elif training_size > 150:
        return 5
    return 2


def _generate_signal_id(home: str, away: str, date_str: str, market: str) -> str:
    """Deterministic signal_id = sha256(fixture_key + market + 'backtest-v1')[:16]."""
    fixture_key = f"{home}_{away}_{date_str}"
    raw = f"{fixture_key}_{market}_backtest-v1"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _reasoning_bahasa(market_type: str, pick: str, model_prob: float,
                      market_odds: float, edge_pct: float) -> str:
    """Generate reasoning string in Bahasa Indonesia (same template as live)."""
    prob_pct = int(model_prob * 100)
    market_implied = int((1 / market_odds) * 100) if market_odds > 0 else 0
    
    if market_type == 'ML':
        return (f"Model Dixon-Coles: {prob_pct}% probabilitas {pick}. "
                f"Odds B365 {market_odds:.2f} (implied {market_implied}%). "
                f"Edge +{edge_pct:.1f}%. Peluang menguntungkan berdasarkan data historis.")
    elif market_type == 'OU':
        return (f"Model: {prob_pct}% probabilitas {pick} 2.5 gol. "
                f"Odds B365 {market_odds:.2f} (implied {market_implied}%). "
                f"Edge +{edge_pct:.1f}%. Distribusi gol mendukung posisi ini.")
    else:  # AH
        return (f"Model: {prob_pct}% probabilitas cover handicap. "
                f"Odds B365 {market_odds:.2f} (implied {market_implied}%). "
                f"Edge +{edge_pct:.1f}%. Analisis statistik mendukung.")


def _evaluate_market(prediction: Dict, match: Dict, market_type: str,
                     model_prob: float, market_odds: float,
                     pinnacle_odds: float, pick_label: str,
                     match_idx: int, training_size: int) -> Optional[Dict]:
    """
    Evaluate a single market for edge.
    Returns pick dict if edge >= MIN_EDGE_PCT and confidence >= MIN_CONFIDENCE.
    """
    if model_prob is None or model_prob <= 0 or market_odds is None or market_odds <= 1.0:
        return None

    fair = 1.0 / model_prob
    edge_pct = ((market_odds / fair) - 1) * 100
    edge_pct = round(edge_pct, 2)

    if edge_pct < MIN_EDGE_PCT:
        return None

    fb = _form_bonus(match_idx, training_size)
    sb = _sample_bonus(training_size)
    confidence_raw = 50 + (edge_pct * 5) + fb + sb
    confidence = min(95, round(confidence_raw, 1))

    if confidence < MIN_CONFIDENCE:
        return None

    date_str = match['date'].strftime('%Y-%m-%d')
    signal_id = _generate_signal_id(match['home_team'], match['away_team'], date_str, market_type)

    return {
        'signal_id': signal_id,
        'market_type': market_type,
        'pick': pick_label,
        'model_prob': round(model_prob, 4),
        'fair_odds': round(fair, 3),
        'market_odds': market_odds,
        'pinnacle_closing_odds': pinnacle_odds,
        'edge_pct': edge_pct,
        'confidence': confidence,
        'match': match,
        'date': date_str,
        'home_team': match['home_team'],
        'away_team': match['away_team'],
        'league': match['league'],
        'season': match['season'],
        'fthg': match['fthg'],
        'ftag': match['ftag'],
        'ftr': match['ftr'],
    }


def backtest_league(league: str, matches: List[Dict]) -> tuple:
    """
    Walk-forward backtest for a single league.
    Returns: (settled_picks, all_predictions_for_sanity_check)
    """
    print(f"\n{'='*60}")
    print(f"  BACKTESTING: {league} ({len(matches)} matches)")
    print(f"  Skip first {SKIP_FIRST_N}, retrain every {RETRAIN_EVERY}")
    print(f"{'='*60}")

    settled_picks = []
    all_predictions = []  # for sanity check
    model = None
    last_train_idx = -1

    for i in range(SKIP_FIRST_N, len(matches)):
        match = matches[i]

        # Retrain checkpoint
        should_retrain = (i - SKIP_FIRST_N) % RETRAIN_EVERY == 0 or model is None
        if should_retrain:
            training_data = matches[:i]  # ONLY matches BEFORE current match
            model = DixonColesModel(rho=-0.10, xi=0.0018)
            model.fit(training_data, reference_date=match['date'])
            last_train_idx = i
            if (i - SKIP_FIRST_N) % 200 == 0:
                print(f"    [{league}] Match {i}/{len(matches)} — trained on {len(training_data)} matches")

        training_size = i  # number of matches available for training

        # Predict
        prediction = model.predict(match['home_team'], match['away_team'])
        
        # Store for sanity check
        all_predictions.append({
            'p_home_win': prediction['p_home_win'],
            'p_draw': prediction['p_draw'],
            'p_away_win': prediction['p_away_win'],
            'p_over_25': prediction['p_over_25'],
            'p_btts': prediction.get('p_btts', prediction['p_over_25']),
            'ah_home_prob': prediction.get('ah_home_prob', prediction['p_home_win']),
        })

        # Evaluate all markets, collect candidates
        candidates = []

        # ML: Home win
        if match.get('b365h') and prediction['p_home_win'] > 0:
            c = _evaluate_market(
                prediction, match, 'ML', prediction['p_home_win'],
                match['b365h'], match.get('psh'), 'Home Win',
                i, training_size
            )
            if c:
                candidates.append(c)

        # ML: Away win
        if match.get('b365a') and prediction['p_away_win'] > 0:
            c = _evaluate_market(
                prediction, match, 'ML', prediction['p_away_win'],
                match['b365a'], match.get('psa'), 'Away Win',
                i, training_size
            )
            if c:
                candidates.append(c)

        # ML: Draw
        if match.get('b365d') and prediction['p_draw'] > 0:
            c = _evaluate_market(
                prediction, match, 'ML', prediction['p_draw'],
                match['b365d'], match.get('psd'), 'Draw',
                i, training_size
            )
            if c:
                candidates.append(c)

        # O/U 2.5: Over
        if match.get('b365_o25') and prediction['p_over_25'] > 0:
            c = _evaluate_market(
                prediction, match, 'OU', prediction['p_over_25'],
                match['b365_o25'], match.get('p_o25'), 'Over 2.5',
                i, training_size
            )
            if c:
                candidates.append(c)

        # O/U 2.5: Under
        if match.get('b365_u25') and prediction['p_under_25'] > 0:
            c = _evaluate_market(
                prediction, match, 'OU', prediction['p_under_25'],
                match['b365_u25'], match.get('p_u25'), 'Under 2.5',
                i, training_size
            )
            if c:
                candidates.append(c)

        # AH: Home cover
        ah_line = match.get('ahh')
        if ah_line is not None and match.get('b365ahh'):
            ah_line_str = str(ah_line)
            ah_probs = prediction.get('ah_probabilities', {})
            if ah_line_str in ah_probs:
                ah_home_prob = ah_probs[ah_line_str]['home']
                c = _evaluate_market(
                    prediction, match, 'AH', ah_home_prob,
                    match['b365ahh'], match.get('pahh'), f'AH Home {ah_line}',
                    i, training_size
                )
                if c:
                    c['ah_line'] = ah_line
                    candidates.append(c)

        # AH: Away cover
        if ah_line is not None and match.get('b365aha'):
            ah_line_str = str(ah_line)
            ah_probs = prediction.get('ah_probabilities', {})
            if ah_line_str in ah_probs:
                ah_away_prob = ah_probs[ah_line_str]['away']
                c = _evaluate_market(
                    prediction, match, 'AH', ah_away_prob,
                    match['b365aha'], match.get('paha'), f'AH Away {ah_line}',
                    i, training_size
                )
                if c:
                    c['ah_line'] = ah_line
                    candidates.append(c)

        # ONE pick per match (highest edge) — same as pick_generator.py
        if not candidates:
            continue

        best = max(candidates, key=lambda c: c['edge_pct'])

        # Verdict (same as pick_generator.py)
        if best['edge_pct'] >= 5 and best['confidence'] >= 80:
            best['verdict'] = 'LAYAK'
        elif best['edge_pct'] >= 3 and best['confidence'] >= 70:
            best['verdict'] = 'PANTAU'
        else:
            continue  # Should not happen given filters, but safety net

        # Settle
        result = _settle_pick(best)
        best['result'] = result
        best['pnl'] = calc_pnl(result, best['market_odds'])

        # Reasoning in Bahasa Indonesia
        best['reasoning'] = _reasoning_bahasa(
            best['market_type'], best['pick'],
            best['model_prob'], best['market_odds'], best['edge_pct']
        )

        settled_picks.append(best)

    print(f"    [{league}] Done: {len(settled_picks)} picks from {len(matches) - SKIP_FIRST_N} evaluated matches")
    return settled_picks, all_predictions


def _settle_pick(pick: Dict) -> str:
    """Settle a single pick using the exact settlement logic."""
    mt = pick['market_type']
    fthg = pick['fthg']
    ftag = pick['ftag']
    ftr = pick['ftr']

    if mt == 'ML':
        selection_map = {'Home Win': 'H', 'Away Win': 'A', 'Draw': 'D'}
        selection = selection_map.get(pick['pick'], 'H')
        return settle_ml(ftr, selection)
    elif mt == 'OU':
        selection = 'Over' if 'Over' in pick['pick'] else 'Under'
        return settle_ou(fthg, ftag, 2.5, selection)
    elif mt == 'AH':
        ah_line = pick.get('ah_line', -0.5)
        selection = 'Home' if 'Home' in pick['pick'] else 'Away'
        return settle_ah(fthg, ftag, ah_line, selection)
    return 'LOST'


def run_backtest(matches_by_league: Dict[str, List[Dict]]) -> tuple:
    """
    Run walk-forward backtest across all leagues.
    Returns: (all_settled_picks, all_predictions)
    """
    all_picks = []
    all_predictions = []

    for league, matches in sorted(matches_by_league.items()):
        if len(matches) < SKIP_FIRST_N + 10:
            print(f"  [SKIP] {league}: only {len(matches)} matches, need >= {SKIP_FIRST_N + 10}")
            continue

        picks, preds = backtest_league(league, matches)
        all_picks.extend(picks)
        all_predictions.extend(preds)

    # Sort all picks by date for cumulative P&L
    all_picks.sort(key=lambda p: p['date'])

    # Compute cumulative profit
    cumulative = 0.0
    for p in all_picks:
        cumulative += p['pnl']
        p['cumulative_profit'] = round(cumulative, 4)

    print(f"\n  TOTAL: {len(all_picks)} picks across all leagues")
    return all_picks, all_predictions
