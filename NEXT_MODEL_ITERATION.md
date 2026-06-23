# Next Model Iteration Recommendations (Post-Stability Validation)

**Status:** UNSTABLE (Signal Stability Validation Failed)

During the Signal Stability Validation milestone, we evaluated the hierarchical 3-level model across 10 random seeds (42, 123, 456, 789, 1024, 2048, 3072, 4096, 5120, 6144). While ECE, Brier score improvements, and fallback checks passed successfully, the strict pressure weight monotonic pattern failed to hold in 4 out of 10 seeds (60% consistency vs. the 80% success threshold).

---

## Why the Current Architecture is Unstable
1. **Noisy State-Specific Gradient Descent**: 
   Since each HT score state is trained independently via gradient descent with no cross-state regularization, the weights are free to fluctuate based on the specific random sample of simulated matches in that state.
2. **Class Imbalance in High-Scoring States**:
   States like `1-1` and `2+` have smaller relative sample sizes or different base rates compared to `0-0`, leading to higher variance in the gradient descent updates for the `pressure` feature.
3. **No Monotonicity Constraint**:
   The gradient descent learner has no mathematical constraint enforcing that the pressure coefficient must increase in magnitude with HT goals.

---

## Proposed Improvements for the Next Iteration

### 1. State Coefficient Regularization (L2 Regularization)
Implement L2 regularization (Ridge) on the state weight learner to prevent overfitting and compress the variance of the learned weights:
$$\mathcal{L} = \mathcal{L}_{BCE} + \lambda \sum w^2$$
This will stabilize the weights across different random initializations.

### 2. Coupled Multi-Task Learning (Hierarchical Prior)
Instead of learning weights for each state completely independently, formulate the weights as deviations from a global weight vector:
$$w_{\text{state}} = w_{\text{global}} + \Delta w_{\text{state}}$$
By penalizing the magnitude of $\Delta w_{\text{state}}$ using a shared prior, we force the weights to remain close to the global pattern unless there is overwhelming data to suggest otherwise.

### 3. Explicit Monotonicity Constraints
Introduce a soft penalty or projection step in gradient descent to enforce the physical constraint that pressure's influence must grow with goals:
$$\text{Penalty} = \gamma \max(0, |w_{\text{pressure}, t}| - |w_{\text{pressure}, t+1}|)$$
This guarantees the pressure pattern holds across seeds.

### 4. Larger Training Sample Sizes
Increase the simulation training set from 10,000 matches to 30,000 matches to reduce sample variance and stabilize the weights.

