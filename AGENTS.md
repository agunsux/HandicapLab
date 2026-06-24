<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# HandicapLab Product Philosophy & Positioning

- **Positioning**: HandicapLab is a football market intelligence platform that identifies statistical inefficiencies and betting market edges using quantitative modeling. Do NOT build tipster-style "AI predictions/picks" screens. Keep it positioned like a Bloomberg Terminal for football markets.
- **Hero Metrics**: Prioritize Closing Line Value (CLV), model calibration curves, expected edges (EV), Brier scores, and Kelly stakes over simple win/loss tallies.
- **Explainability**: Every prediction requires a statistical breakdown (e.g., xG indicators, ELO shifts, home advantage values) rather than just black-box percentages.
- **Pricing & Tiering**: Maintain clear delineations between Free, Starter ($9/mo), Pro ($29/mo), and Quant ($99/mo) plans.
