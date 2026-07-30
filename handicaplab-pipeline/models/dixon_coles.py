"""
Dixon-Coles (1997) Probability Model
=====================================
A bivariate Poisson model for football scores with low-score correction (rho).

Key features:
- Attack (α) and defense (β) parameters per team
- Home advantage (γ)
- Time-decay weighting (xi) — recent matches matter more
- Tau correction for 0-0, 1-0, 0-1, 1-1 scores
- Quarter-line handling for Asian Handicap

Training is WEEKLY (not daily). The daily pipeline loads cached params.
"""

import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy.optimize import minimize
from scipy.stats import poisson

from config import DC_RHO, DC_XI, DC_HOME_ADV, CACHE_TTL_MODEL
from cache.local_cache import LocalCache

logger = logging.getLogger(__name__)

# Asian Handicap lines to compute probabilities for
AH_LINES = [-1.5, -1.0, -0.75, -0.5, -0.25, 0, 0.25, 0.5]


class DixonColesModel:
    """
    Dixon-Coles probability model for football matches.

    Usage:
        model = DixonColesModel(cache)
        model.train(historical_matches)  # weekly
        result = model.predict("Team A", "Team B")  # daily
    """

    def __init__(self, cache: LocalCache):
        self.cache = cache
        self.params: Optional[Dict[str, Any]] = None
        self._loaded = False

    # ── Training ──────────────────────────────────────────────────────────

    def train(self, matches: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Train the Dixon-Coles model via MLE.

        Args:
            matches: list of dicts with home_team, away_team,
                     home_goals, away_goals, timestamp (unix)

        Returns: fitted parameters dict
        """
        logger.info(f"[DC] Training model on {len(matches)} matches")

        # Extract unique teams
        teams = set()
        for m in matches:
            teams.add(m["home_team"])
            teams.add(m["away_team"])
        teams = sorted(teams)
        n_teams = len(teams)
        team_to_idx = {t: i for i, t in enumerate(teams)}

        logger.info(f"[DC] {n_teams} unique teams found")

        # Prepare data arrays
        home_goals = np.array([m["home_goals"] for m in matches], dtype=float)
        away_goals = np.array([m["away_goals"] for m in matches], dtype=float)
        home_idx = np.array([team_to_idx[m["home_team"]] for m in matches])
        away_idx = np.array([team_to_idx[m["away_team"]] for m in matches])

        # Time-decay weights
        if matches[0].get("timestamp"):
            now = max(m["timestamp"] for m in matches)
            weights = np.array([
                math.exp(-DC_XI * (now - m["timestamp"]) / 86400)
                for m in matches
            ])
        else:
            weights = np.ones(len(matches))

        # Initial parameter guess
        # Params: [home_adv, attack_1..attack_n, defense_1..defense_n]
        # We fix one attack and one defense to 0 for identifiability
        x0 = np.zeros(1 + 2 * n_teams)
        x0[0] = DC_HOME_ADV  # home advantage
        # Set initial attacks to log(avg_home_goals)
        avg_home = np.mean(home_goals)
        for i in range(n_teams):
            x0[1 + i] = math.log(max(avg_home * 0.8, 0.1))

        # Bounds: home_adv unbounded, attack > -5, defense > -5
        bounds = [(None, None)] + [(-5, 5)] * (2 * n_teams)

        # Optimize
        result = minimize(
            self._neg_log_likelihood,
            x0,
            args=(home_goals, away_goals, home_idx, away_idx, weights, n_teams),
            method="L-BFGS-B",
            bounds=bounds,
            options={"maxiter": 5000, "ftol": 1e-8},
        )

        if not result.success:
            logger.warning(f"[DC] MLE did not converge: {result.message}")

        # Extract parameters
        home_adv = result.x[0]
        attacks = result.x[1:1 + n_teams]
        defenses = result.x[1 + n_teams:]

        # Fix identifiability: set median attack = 0, median defense = 0
        attacks -= np.median(attacks)
        defenses -= np.median(defenses)

        self.params = {
            "home_advantage": float(home_adv),
            "teams": teams,
            "attacks": {t: float(attacks[i]) for i, t in enumerate(teams)},
            "defenses": {t: float(defenses[i]) for i, t in enumerate(teams)},
            "rho": DC_RHO,
            "xi": DC_XI,
            "n_matches": len(matches),
            "log_likelihood": float(result.fun),
        }

        # Cache the params
        self.cache.set("model_params", self.params)
        self._loaded = True

        logger.info(f"[DC] Training complete. Home advantage: {home_adv:.3f}")
        return self.params

    def load_or_train(self, matches: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Load cached params, or train if no cache exists.
        Call this in daily_fetch.py — it will NOT retrain if cache is fresh.
        """
        cached = self.cache.get("model_params", CACHE_TTL_MODEL)
        if cached is not None:
            logger.info("[DC] Using cached model parameters")
            self.params = cached
            self._loaded = True
            return cached

        if matches is None:
            raise ValueError(
                "[DC] No cached model found and no training data provided. "
                "Run weekly training first."
            )

        return self.train(matches)

    # ── Prediction ────────────────────────────────────────────────────────

    def predict(self, home_team: str, away_team: str) -> Dict[str, Any]:
        """
        Predict match outcome probabilities.

        Returns dict with:
            lambda_home, lambda_away,
            score_matrix (10x10),
            p_home_win, p_draw, p_away_win,
            p_over_25, p_under_25,
            ah_probabilities for lines [-1.5..+0.5]
        """
        if not self._loaded or self.params is None:
            raise RuntimeError("[DC] Model not trained. Call load_or_train() first.")

        attacks = self.params["attacks"]
        defenses = self.params["defenses"]
        gamma = self.params["home_advantage"]
        rho = self.params["rho"]

        # Get team parameters (use league average if team not found)
        home_att = attacks.get(home_team, 0.0)
        home_def = defenses.get(home_team, 0.0)
        away_att = attacks.get(away_team, 0.0)
        away_def = defenses.get(away_team, 0.0)

        # Expected goals
        lambda_home = math.exp(gamma + home_att - away_def)
        lambda_away = math.exp(away_att - home_def)

        # Cap extreme values
        lambda_home = min(max(lambda_home, 0.1), 6.0)
        lambda_away = min(max(lambda_away, 0.1), 6.0)

        # Compute 10x10 score matrix (0-9 goals each)
        score_matrix = np.zeros((10, 10))
        for i in range(10):
            for j in range(10):
                p = poisson.pmf(i, lambda_home) * poisson.pmf(j, lambda_away)
                # Tau correction for low scores
                p *= self._tau(i, j, lambda_home, lambda_away, rho)
                score_matrix[i, j] = p

        # Normalise
        score_matrix /= score_matrix.sum()

        # Match outcome probabilities
        p_home_win = float(sum(score_matrix[i, j] for i in range(10) for j in range(10) if i > j))
        p_draw = float(sum(score_matrix[i, j] for i in range(10) for j in range(10) if i == j))
        p_away_win = float(sum(score_matrix[i, j] for i in range(10) for j in range(10) if i < j))

        # Over/Under 2.5
        p_over_25 = float(sum(score_matrix[i, j] for i in range(10) for j in range(10) if i + j > 2))
        p_under_25 = 1.0 - p_over_25

        # Asian Handicap probabilities
        ah_probs = {}
        for line in AH_LINES:
            ah_probs[str(line)] = self._asian_handicap_prob(score_matrix, line)

        return {
            "lambda_home": round(lambda_home, 4),
            "lambda_away": round(lambda_away, 4),
            "score_matrix": score_matrix.tolist(),
            "p_home_win": round(p_home_win, 4),
            "p_draw": round(p_draw, 4),
            "p_away_win": round(p_away_win, 4),
            "p_over_25": round(p_over_25, 4),
            "p_under_25": round(p_under_25, 4),
            "ah_probabilities": ah_probs,
        }

    # ── Static Helpers ────────────────────────────────────────────────────

    @staticmethod
    def fair_odds(probability: float) -> float:
        """Convert probability to fair decimal odds."""
        if probability <= 0:
            return 999.0
        return round(1.0 / probability, 4)

    @staticmethod
    def _neg_log_likelihood(
        params: np.ndarray,
        home_goals: np.ndarray,
        away_goals: np.ndarray,
        home_idx: np.ndarray,
        away_idx: np.ndarray,
        weights: np.ndarray,
        n_teams: int,
    ) -> float:
        """Negative log-likelihood for MLE optimisation."""
        gamma = params[0]
        attacks = params[1:1 + n_teams]
        defenses = params[1 + n_teams:]

        nll = 0.0
        for idx in range(len(home_goals)):
            h = home_idx[idx]
            a = away_idx[idx]

            lam_h = math.exp(gamma + attacks[h] - defenses[a])
            lam_a = math.exp(attacks[a] - defenses[h])

            # Clamp
            lam_h = max(lam_h, 0.01)
            lam_a = max(lam_a, 0.01)

            hg = int(home_goals[idx])
            ag = int(away_goals[idx])

            p = poisson.pmf(hg, lam_h) * poisson.pmf(ag, lam_a)
            p *= DixonColesModel._tau(hg, ag, lam_h, lam_a, DC_RHO)
            p = max(p, 1e-15)

            nll -= weights[idx] * math.log(p)

        return nll

    @staticmethod
    def _tau(i: int, j: int, lam_h: float, lam_a: float, rho: float) -> float:
        """Dixon-Coles tau correction for low scores."""
        if i == 0 and j == 0:
            return 1.0 - rho * lam_h * lam_a
        elif i == 0 and j == 1:
            return 1.0 + rho * lam_h
        elif i == 1 and j == 0:
            return 1.0 + rho * lam_a
        elif i == 1 and j == 1:
            return 1.0 - rho
        else:
            return 1.0

    @staticmethod
    def _asian_handicap_prob(score_matrix: np.ndarray, line: float) -> float:
        """
        Compute probability of home team covering a given Asian Handicap line.
        Handles quarter-lines as half-win/half-loss.
        """
        n = score_matrix.shape[0]
        prob = 0.0

        for i in range(n):
            for j in range(n):
                diff = i - j
                adjusted = diff + line

                if adjusted > 0:
                    prob += score_matrix[i, j]  # Full win
                elif adjusted == 0:
                    prob += 0.5 * score_matrix[i, j]  # Half win / push
                # adjusted < 0 = loss, no contribution

        return round(float(prob), 4)
