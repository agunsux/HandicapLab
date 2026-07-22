# HandicapLab Research & Experimental Backlog
**Deferred Research Candidates — Evidence Accumulation Phase**

> **"All experimental models remain strictly isolated in the Research Sandbox until 5,000 live settled predictions are verified on the v2.8 LTS Production branch."**

---

## Isolated Experimental Candidates

The following research directions are intentionally deferred during the **Operation Year One** evidence accumulation campaign to prevent model behavior drift on production:

### 1. Advanced Probability & Rating Architectures
- **Bayesian Hierarchical Models**: Multi-level team attack/defense strength estimation with league-wide hyper-priors.
- **Time-Varying Dixon–Coles**: Dynamic time-decay parameters $\lambda(t), \mu(t)$ adapting continuously to team form shifts.
- **Player Availability Embeddings**: Lineup & key player availability vector representations via transfer market data.

### 2. Market Dynamics & Microstructure
- **Market Microstructure Features**: High-frequency order book imbalance signals and liquidity-weighted odds movements.
- **Odds Movement Embeddings**: Latent representation of sharp money vs public money capital flows pre-kickoff.

### 3. Contextual & Environmental Vectors
- **Pitch Condition & Weather Models**: Wind, precipitation, and pitch dimension adjustment factors for total goal distributions.
- **Enhanced Travel Fatigue Vectors**: Multi-flight travel distance, time-zone shifts, and rest-day differential matrices.

### 4. Deep Learning & Sequence Models
- **Graph Neural Networks (GNN)**: Passing network topology and team tactical interaction graphs.
- **Transformer Sequence Models**: Attention-based sequential fixture modeling over rolling match histories.

---

## Promotion Protocol to Production

An experimental model candidate from this backlog will ONLY be considered for production promotion if:
1. It is evaluated out-of-sample on $\ge 2,500$ historical matches.
2. It demonstrates a statistically significant reduction in Brier Score ($p < 0.01$).
3. It passes the 5-Stage Verification Protocol (Unit, Integration, Regression, LeakageGuard, and Benchmark).
