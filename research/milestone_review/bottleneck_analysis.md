# Part 8: Bottleneck Analysis
1. **Categorical Handling**: LightGBM struggles with high-cardinality discretes (Manager, Stadium). Cause: Manual encoding. Priority: HIGH.
2. **Favorite/Chalk Leak**: Overconfidence on heavy favorites. Cause: Standard LogLoss penalizes extreme misses symmetrically. Priority: HIGH.
3. **Early Season Variance**: Lack of prior season carry-over features. Priority: MED.
4. **Market Line Velocity**: Missing temporal tracking of odds movement. Priority: MED.
5. **Draw Detection**: Difficulty mapping the non-linear threshold of draws. Priority: LOW.
