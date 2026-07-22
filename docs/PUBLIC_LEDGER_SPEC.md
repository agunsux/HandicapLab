# PUBLIC PREDICTION LEDGER SPECIFICATION

**Subsystem:** `src/lib/public-ledger/ledger-engine.ts`

---

## Cryptographic Hash Invariants

For every public prediction record $R$, compute:

$$\text{Prediction Hash} = \text{SHA256}(\text{PredictionID} \parallel \text{FixtureID} \parallel \text{ModelVersion} \parallel \text{Market} \parallel \text{Selection} \parallel \text{Prob} \parallel \text{EV})$$

### Invariant Rules:
1. **Append-Only**: Historical prediction records are strictly immutable. Settlement only appends outcome metrics.
2. **Sequential IDs**: Predictions receive sequential formatted identifiers (`#000001`, `#000002`).
3. **No Deletion**: Deletion or silent overwriting is mathematically prevented by SHA-256 verification.
