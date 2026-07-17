<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# HandicapLab Product Philosophy & Positioning

- **Positioning**: HandicapLab is a football market intelligence platform that identifies statistical inefficiencies and betting market edges using quantitative modeling. Do NOT build tipster-style "AI predictions/picks" screens. Keep it positioned like a Bloomberg Terminal for football markets.
- **Hero Metrics**: Prioritize Closing Line Value (CLV), model calibration curves, expected edges (EV), Brier scores, and Kelly stakes over simple win/loss tallies.
- **Explainability**: Every prediction requires a statistical breakdown (e.g., xG indicators, ELO shifts, home advantage values) rather than just black-box percentages.
- **Pricing & Tiering**: Maintain clear delineations between Free, Starter ($9/mo), Pro ($29/mo), and Quant ($99/mo) plans.

# SOP & Definition of Done (DoD) - Sprint 26+

For all upcoming sprints, enforce the following structured release flow:
1. **Implement**: Write code modularly.
2. **Unit Test**: Target 100% success of unit tests.
3. **Integration Test**: Assure module communication works.
4. **Regression Test & Backtest**: Run historical validation backtests to confirm zero changes/regression in model outcomes.
5. **Benchmark**: Execute stress tests and verify latency parameters.
6. **Verification Report**: Create a detailed, audited completion report artifact.
7. **Acceptance Checklist**: Confirm all checklist points are ticked.
8. **Git Commit, Tag, Push & Deploy**: Push to GitHub, tag release, and deploy to Vercel.
9. **Smoke Test**: Assert that public and private endpoints respond successfully in production.

# Research Invariants & Data Governance

- **No Future Leakage**: Tidak boleh ada feature yang berasal dari data dengan timestamp ≥ kickoff pertandingan yang diprediksi.
- **No extraordinary result without audit**: Jika ada ROI > 10%, atau peningkatan Brier > 10%, atau lonjakan performa yang tidak biasa, sistem harus otomatis meminta audit terhadap potensi leakage, definisi target, pembagian data, sample size, dan metodologi evaluasi.
