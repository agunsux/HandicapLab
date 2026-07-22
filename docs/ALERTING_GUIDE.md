# ALERTING ENGINE MANUAL

**Subsystem:** `src/live-validation/alerts/`

---

## Alert Rules & Channels

The alert engine evaluates system health and model stability after every settlement and metric computation cycle.

### Configured Rules:
1. `roi_below_threshold`: Fires when 30-day ROI drops below -5.0%.
2. `clv_negative`: Fires when 30-day average CLV drops below 0.0%.
3. `calibration_degraded`: Fires when Expected Calibration Error (ECE) exceeds 5.0%.
4. `brier_score_high`: Fires when 30-day Brier score exceeds 0.2200.
5. `drawdown_exceeded`: Fires when maximum drawdown exceeds 15.0%.
6. `scheduler_failure`: Fires when fixture discovery or prediction execution fails.
7. `settlement_failure`: Fires when result settlement processing fails.

### Supported Channels:
- **Email** (SMTP / SendGrid)
- **Discord** (Webhook bot)
- **Slack** (Incoming webhook)
- **Generic Webhook** (POST JSON payload)
