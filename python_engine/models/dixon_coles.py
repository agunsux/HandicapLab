"""
models/dixon_coles.py — Dixon-Coles (1997) model with real MLE fitting.
Parameters: per-team attack (α), defense (β), home advantage (γ), rho correction (ρ).
Exponential time-decay weighting (ξ).
"""
import numpy as np
from scipy.stats import poisson
from scipy.optimize import minimize
from typing import Dict, List, Optional, Tuple
from datetime import datetime


class DixonColesModel:
    def __init__(self, rho: float = -0.10, xi: float = 0.0018):
        self.rho = rho
        self.xi = xi
        self.teams = []
        self.alpha = {}  # attack strength
        self.beta = {}   # defense weakness
        self.gamma = 0.0  # home advantage (log scale)
        self._fitted = False

    def _tau(self, x: int, y: int, lambda_x: float, lambda_y: float, rho: float) -> float:
        """Dixon-Coles low-score correction factor tau."""
        if x == 0 and y == 0:
            return 1.0 - lambda_x * lambda_y * rho
        elif x == 0 and y == 1:
            return 1.0 + lambda_x * rho
        elif x == 1 and y == 0:
            return 1.0 + lambda_y * rho
        elif x == 1 and y == 1:
            return 1.0 - rho
        return 1.0

    def fit(self, matches: List[Dict], reference_date: Optional[datetime] = None):
        """
        Fit the model via MLE on historical matches.
        
        Each match dict needs: 'home_team', 'away_team', 'fthg', 'ftag', 'date'.
        reference_date: date for time-decay weighting (latest match date if None).
        """
        if len(matches) < 20:
            print(f"  [DC] Too few matches ({len(matches)}), using league-average params.")
            self._set_league_average(matches)
            return

        # Collect teams
        teams = sorted(set(
            [m['home_team'] for m in matches] + [m['away_team'] for m in matches]
        ))
        self.teams = teams
        n_teams = len(teams)
        team_idx = {t: i for i, t in enumerate(teams)}

        # Reference date for time-decay
        if reference_date is None:
            reference_date = max(m['date'] for m in matches)

        # Time-decay weights
        weights = []
        for m in matches:
            days_ago = (reference_date - m['date']).days
            w = np.exp(-self.xi * days_ago)
            weights.append(w)
        weights = np.array(weights)

        # Match data arrays
        home_idx = np.array([team_idx[m['home_team']] for m in matches])
        away_idx = np.array([team_idx[m['away_team']] for m in matches])
        home_goals = np.array([m['fthg'] for m in matches])
        away_goals = np.array([m['ftag'] for m in matches])

        # Parameter vector: [alpha_0..n-1, beta_0..n-1, gamma, rho]
        # Total: 2*n_teams + 2
        # Constraint: sum(alpha) = n_teams (identifiability)
        n_params = 2 * n_teams + 2

        def neg_log_likelihood(params):
            alphas = params[:n_teams]
            betas = params[n_teams:2 * n_teams]
            gamma = params[2 * n_teams]
            rho = params[2 * n_teams + 1]

            # Clamp rho to valid range
            rho = max(-0.5, min(0.5, rho))

            lambda_h = np.maximum(0.01, np.exp(alphas[home_idx] + betas[away_idx] + gamma))
            lambda_a = np.maximum(0.01, np.exp(alphas[away_idx] + betas[home_idx]))

            x = home_goals
            y = away_goals

            # Vectorized Poisson log-likelihood
            log_p_x = poisson.logpmf(x, lambda_h)
            log_p_y = poisson.logpmf(y, lambda_a)

            # Vectorized tau calculation
            tau = np.ones_like(x, dtype=float)
            mask_00 = (x == 0) & (y == 0)
            mask_01 = (x == 0) & (y == 1)
            mask_10 = (x == 1) & (y == 0)
            mask_11 = (x == 1) & (y == 1)
            
            tau[mask_00] = 1.0 - lambda_h[mask_00] * lambda_a[mask_00] * rho
            tau[mask_01] = 1.0 + lambda_h[mask_01] * rho
            tau[mask_10] = 1.0 + lambda_a[mask_10] * rho
            tau[mask_11] = 1.0 - rho
            
            tau = np.maximum(1e-10, tau)
            log_tau = np.log(tau)

            nll = -np.sum(weights * (log_p_x + log_p_y + log_tau))

            # Soft identifiability constraint: sum(alpha) ≈ 0
            nll += 100.0 * (np.sum(alphas)) ** 2

            return nll

        # Initial guesses
        x0 = np.zeros(n_params)
        x0[2 * n_teams] = 0.25  # gamma (home advantage)
        x0[2 * n_teams + 1] = -0.05  # rho

        # Optimize
        result = minimize(
            neg_log_likelihood, x0,
            method='L-BFGS-B',
            options={'maxiter': 300, 'ftol': 1e-6}
        )

        # Extract parameters
        params = result.x
        for i, team in enumerate(teams):
            self.alpha[team] = float(params[i])
            self.beta[team] = float(params[n_teams + i])
        self.gamma = float(params[2 * n_teams])
        self.rho = float(max(-0.5, min(0.5, params[2 * n_teams + 1])))
        self._fitted = True

    def _set_league_average(self, matches: List[Dict]):
        """Fallback: set all teams to league average."""
        teams = sorted(set(
            [m['home_team'] for m in matches] + [m['away_team'] for m in matches]
        ))
        self.teams = teams
        for t in teams:
            self.alpha[t] = 0.0
            self.beta[t] = 0.0
        self.gamma = 0.25
        self._fitted = True

    def _get_alpha(self, team: str) -> float:
        """Get attack param, falling back to league average for unknown teams."""
        return self.alpha.get(team, 0.0)

    def _get_beta(self, team: str) -> float:
        """Get defense param, falling back to league average for unknown teams."""
        return self.beta.get(team, 0.0)

    def predict(self, home_team: str, away_team: str) -> Dict:
        """
        Predict match probabilities from fitted parameters.
        Returns dict with: p_home_win, p_draw, p_away_win, p_over_25, p_under_25,
                          score_matrix, ah_probabilities, lambda_home, lambda_away.
        """
        alpha_h = self._get_alpha(home_team)
        beta_h = self._get_beta(home_team)
        alpha_a = self._get_alpha(away_team)
        beta_a = self._get_beta(away_team)

        lambda_home = max(0.1, np.exp(alpha_h + beta_a + self.gamma))
        lambda_away = max(0.1, np.exp(alpha_a + beta_h))

        # Score matrix (10x10)
        max_goals = 10
        score_matrix = np.zeros((max_goals, max_goals))
        for x in range(max_goals):
            for y in range(max_goals):
                p_x = poisson.pmf(x, lambda_home)
                p_y = poisson.pmf(y, lambda_away)
                tau = self._tau(x, y, lambda_home, lambda_away, self.rho)
                score_matrix[x, y] = p_x * p_y * tau

        # Normalize
        total = score_matrix.sum()
        if total > 0:
            score_matrix /= total

        # Match outcome probabilities
        p_home_win = float(np.tril(score_matrix, -1).sum())
        p_draw = float(np.trace(score_matrix))
        p_away_win = float(np.triu(score_matrix, 1).sum())

        # Over/Under 2.5
        p_under_25 = 0.0
        p_over_25 = 0.0
        for x in range(max_goals):
            for y in range(max_goals):
                if x + y <= 2:
                    p_under_25 += score_matrix[x, y]
                else:
                    p_over_25 += score_matrix[x, y]

        # BTTS (Both Teams To Score)
        p_btts = 0.0
        for x in range(1, max_goals):
            for y in range(1, max_goals):
                p_btts += score_matrix[x, y]

        # AH probabilities for common lines
        ah_probs = {}
        for line in [-2.5, -2.0, -1.5, -1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0, 1.5]:
            p_home_cover = 0.0
            p_push = 0.0
            for x in range(max_goals):
                for y in range(max_goals):
                    margin = (x - y) + line
                    if margin > 0:
                        p_home_cover += score_matrix[x, y]
                    elif margin == 0:
                        p_push += score_matrix[x, y]
            ah_probs[str(line)] = {
                'home': float(p_home_cover),
                'push': float(p_push),
                'away': float(1.0 - p_home_cover - p_push),
            }

        return {
            'lambda_home': float(lambda_home),
            'lambda_away': float(lambda_away),
            'score_matrix': score_matrix.tolist(),
            'p_home_win': p_home_win,
            'p_draw': p_draw,
            'p_away_win': p_away_win,
            'p_under_25': float(p_under_25),
            'p_over_25': float(p_over_25),
            'p_btts': float(p_btts),
            'ah_probabilities': ah_probs,
            'ah_home_prob': ah_probs.get(str(-0.5), {}).get('home', p_home_win),
        }

    def fair_odds(self, p: float) -> float:
        """Convert probability to fair decimal odds."""
        if p <= 0:
            return 999.0
        return round(1.0 / p, 3)
