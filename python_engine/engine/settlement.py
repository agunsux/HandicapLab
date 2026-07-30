"""
engine/settlement.py — Exact settlement logic for ML, O/U, and AH markets.
Shared between backtest seeder and live nightly_settle.py.
"""


def settle_ml(ftr: str, selection: str) -> str:
    """Settle moneyline bet. selection = 'H', 'D', or 'A'."""
    if ftr == selection:
        return 'WON'
    return 'LOST'


def settle_ou(fthg: int, ftag: int, line: float, selection: str) -> str:
    """Settle over/under bet. selection = 'Over' or 'Under'."""
    total = fthg + ftag
    if selection == 'Over':
        if total > line:
            return 'WON'
        elif total == line:
            return 'PUSH'
        else:
            return 'LOST'
    else:  # Under
        if total < line:
            return 'WON'
        elif total == line:
            return 'PUSH'
        else:
            return 'LOST'


def _settle_ah_whole_or_half(margin: float) -> str:
    """Settle a single AH component (whole or half-integer line)."""
    if margin > 0:
        return 'WON'
    elif margin == 0:
        return 'PUSH'
    else:
        return 'LOST'


def settle_ah(fthg: int, ftag: int, ah_line: float, selection: str) -> str:
    """
    Settle Asian Handicap bet.
    ah_line = the line from the home team's perspective (e.g., -0.5, -1.0, -0.25).
    selection = 'Home' or 'Away'.
    
    For quarter lines (e.g., -0.25, -0.75), we split into two components
    and return a composite result.
    """
    goal_diff = fthg - ftag  # from home perspective

    if selection == 'Away':
        # Flip perspective: away handicap = -ah_line
        ah_line = -ah_line
        goal_diff = -goal_diff

    margin = goal_diff + ah_line

    # Check if quarter line
    fractional = abs(ah_line) - int(abs(ah_line))
    is_quarter = abs(fractional - 0.25) < 0.01 or abs(fractional - 0.75) < 0.01

    if not is_quarter:
        # Whole or half-integer line
        return _settle_ah_whole_or_half(margin)

    # Quarter line: split into two components 50/50
    if abs(fractional - 0.25) < 0.01:
        # e.g., -0.25 → half on 0, half on -0.5
        sign = 1 if ah_line >= 0 else -1
        base = int(abs(ah_line)) * sign
        line_a = base  # e.g., 0
        line_b = base + sign * (-0.5) if ah_line < 0 else base + 0.5  # e.g., -0.5
        # Simpler: -0.25 → 0 and -0.5
        line_a = ah_line + 0.25 if ah_line < 0 else ah_line - 0.25
        line_b = ah_line - 0.25 if ah_line < 0 else ah_line + 0.25
    else:
        # e.g., -0.75 → half on -0.5, half on -1.0
        line_a = ah_line + 0.25 if ah_line < 0 else ah_line - 0.25
        line_b = ah_line - 0.25 if ah_line < 0 else ah_line + 0.25

    margin_a = goal_diff + line_a
    margin_b = goal_diff + line_b

    result_a = _settle_ah_whole_or_half(margin_a)
    result_b = _settle_ah_whole_or_half(margin_b)

    # Composite result
    if result_a == 'WON' and result_b == 'WON':
        return 'WON'
    elif result_a == 'LOST' and result_b == 'LOST':
        return 'LOST'
    elif result_a == 'WON' and result_b == 'PUSH':
        return 'HALF_WIN'
    elif result_a == 'PUSH' and result_b == 'WON':
        return 'HALF_WIN'
    elif result_a == 'LOST' and result_b == 'PUSH':
        return 'HALF_LOSS'
    elif result_a == 'PUSH' and result_b == 'LOST':
        return 'HALF_LOSS'
    elif result_a == 'WON' and result_b == 'LOST':
        return 'PUSH'  # net zero
    elif result_a == 'LOST' and result_b == 'WON':
        return 'PUSH'  # net zero
    else:
        return 'PUSH'


def calc_pnl(result: str, odds: float) -> float:
    """
    Calculate profit/loss per 1-unit stake.
    win = odds - 1, loss = -1, push = 0,
    half_win = 0.5 * (odds - 1), half_loss = -0.5
    """
    if result == 'WON':
        return odds - 1.0
    elif result == 'LOST':
        return -1.0
    elif result == 'PUSH':
        return 0.0
    elif result == 'HALF_WIN':
        return 0.5 * (odds - 1.0)
    elif result == 'HALF_LOSS':
        return -0.5
    return 0.0


def win_count(result: str) -> float:
    """Return win count for win_rate: half-wins count as 0.5."""
    if result == 'WON':
        return 1.0
    elif result == 'HALF_WIN':
        return 0.5
    return 0.0


def is_countable(result: str) -> bool:
    """Return True if result counts toward win/loss tallies (excludes PUSH)."""
    return result in ('WON', 'LOST', 'HALF_WIN', 'HALF_LOSS')
