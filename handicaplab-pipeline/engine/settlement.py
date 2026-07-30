"""
Settlement Engine
=================
Exact math for settling picks by actual match results.

Handles:
- Moneyline (HOME/DRAW/AWAY)
- Over/Under 2.5
- Asian Handicap (integer and quarter lines)

P&L per 1-unit stake:
- win = odds - 1
- loss = -1
- push = 0
- half-win = 0.5 * (odds - 1)
- half-loss = -0.5

Quarter-line AH splits stake 50/50:
  -0.25 -> half on 0, half on -0.5
  -0.75 -> half on -0.5, half on -1.0

This module is importable by the LIVE nightly_settle.py too (shared logic).
"""

import logging
from typing import Tuple

logger = logging.getLogger(__name__)


def _pnl_win(odds: float) -> float:
    return odds - 1.0


def _pnl_loss() -> float:
    return -1.0


def _pnl_push() -> float:
    return 0.0


def _pnl_half_win(odds: float) -> float:
    return 0.5 * (odds - 1.0)


def _pnl_half_loss() -> float:
    return -0.5


def settle_moneyline(
    fthg: int, ftag: int, prediction: str, market_odds: float = 1.0
) -> Tuple[str, float]:
    """
    Settle a moneyline pick.

    Args:
        fthg: Full-time home goals
        ftag: Full-time away goals
        prediction: "HOME", "DRAW", or "AWAY"
        market_odds: Decimal odds at which the pick was taken

    Returns:
        (result, pnl) where result is "WON", "LOST", or "PUSH"
    """
    if fthg > ftag:
        actual = "HOME"
    elif fthg == ftag:
        actual = "DRAW"
    else:
        actual = "AWAY"

    if actual == prediction:
        return "WON", _pnl_win(market_odds)
    else:
        return "LOST", _pnl_loss()


def settle_over_under(
    fthg: int, ftag: int, line: float, prediction: str, market_odds: float = 1.0
) -> Tuple[str, float]:
    """
    Settle an over/under pick.

    Args:
        fthg: Full-time home goals
        ftag: Full-time away goals
        line: Total line (e.g. 2.5)
        prediction: "OVER" or "UNDER"
        market_odds: Decimal odds at which the pick was taken

    Returns:
        (result, pnl) where result is "WON", "LOST", or "PUSH"
    """
    total = fthg + ftag

    if total > line:
        actual = "OVER"
    elif total == line:
        actual = "PUSH"
    else:
        actual = "UNDER"

    if actual == "PUSH":
        return "PUSH", _pnl_push()

    if actual == prediction:
        return "WON", _pnl_win(market_odds)
    else:
        return "LOST", _pnl_loss()


def _settle_ah_part(
    fthg: int, ftag: int, ah_line: float, market_odds: float = 1.0
) -> Tuple[str, float]:
    """
    Settle a single Asian Handicap part (integer or half-line).

    Args:
        fthg: Full-time home goals
        ftag: Full-time away goals
        ah_line: AH line (e.g. -0.5, 0, +0.5)
        market_odds: Decimal odds

    Returns:
        (result, pnl) where result is "WON", "LOST", "PUSH", "HALF_WIN", or "HALF_LOSS"
    """
    margin = fthg - ftag + ah_line

    if margin > 0:
        return "WON", _pnl_win(market_odds)
    elif margin == 0:
        return "PUSH", _pnl_push()
    else:
        return "LOST", _pnl_loss()


def settle_asian_handicap(
    fthg: int,
    ftag: int,
    ah_line: float,
    prediction: str,
    market_odds: float = 1.0,
) -> Tuple[str, float]:
    """
    Settle an Asian Handicap pick.

    Quarter lines split stake 50/50:
      -0.25 -> half on 0, half on -0.5
      -0.75 -> half on -0.5, half on -1.0
      +0.25 -> half on 0, half on +0.5
      +0.75 -> half on +0.5, half on +1.0

    Args:
        fthg: Full-time home goals
        ftag: Full-time away goals
        ah_line: AH line (e.g. -0.75)
        prediction: "AH HOME {line}" or "AH AWAY {line}"
        market_odds: Decimal odds at which the pick was taken

    Returns:
        (result, pnl)
    """
    # Normalize line to home perspective
    if "AWAY" in prediction:
        ah_line = -ah_line

    # Quarter line handling
    if abs(ah_line - 0.25) < 0.01:
        part1_line = 0.0
        part2_line = -0.5
    elif abs(ah_line + 0.25) < 0.01:
        part1_line = 0.0
        part2_line = 0.5
    elif abs(ah_line - 0.75) < 0.01:
        part1_line = -0.5
        part2_line = -1.0
    elif abs(ah_line + 0.75) < 0.01:
        part1_line = 0.5
        part2_line = 1.0
    else:
        # Integer or half line — single part
        r1, pnl1 = _settle_ah_part(fthg, ftag, ah_line, market_odds)
        return r1, pnl1

    # Split stake 50/50
    r1, pnl1 = _settle_ah_part(fthg, ftag, part1_line, market_odds)
    r2, pnl2 = _settle_ah_part(fthg, ftag, part2_line, market_odds)

    total_pnl = 0.5 * pnl1 + 0.5 * pnl2

    # Determine aggregate result
    wins = sum(1 for r in (r1, r2) if r == "WON")
    losses = sum(1 for r in (r1, r2) if r == "LOST")
    pushes = sum(1 for r in (r1, r2) if r == "PUSH")

    if wins == 2:
        result = "WON"
    elif losses == 2:
        result = "LOST"
    elif wins == 1 and losses == 1:
        result = "PUSH"
    elif wins == 1 and pushes == 1:
        result = "HALF_WIN"
    elif losses == 1 and pushes == 1:
        result = "HALF_LOSS"
    else:
        result = "PUSH"

    return result, total_pnl
