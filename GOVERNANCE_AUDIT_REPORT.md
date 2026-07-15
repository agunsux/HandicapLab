=========================================================
  STATISTICAL GOVERNANCE AUDIT REPORT
=========================================================
  Generated: 2026-07-15T12:41:05.203Z
  Total Findings: 143
  Errors: 0
  Warnings: 9
=========================================================

  ⚠️ WARN (9):

    [zero-data] app\(app)\scanner\page.tsx
    Uses || 0 fallback for metric display. Consider using descriptive empty state.

    [zero-data] app\api\admin\model-health\route.ts
    Uses || 0 fallback for metric display. Consider using descriptive empty state.

    [zero-data] app\api\admin\model-validation\route.ts
    Uses || 0 fallback for metric display. Consider using descriptive empty state.

    [zero-data] app\api\admin\shadow-performance\route.ts
    Uses || 0 fallback for metric display. Consider using descriptive empty state.

    [zero-data] app\api\admin\weekly-model-report\route.ts
    Uses || 0 fallback for metric display. Consider using descriptive empty state.

    [zero-data] app\api\cron\biweekly-model-report\route.ts
    Uses || 0 fallback for metric display. Consider using descriptive empty state.

    [zero-data] app\api\signals\[id]\route.ts
    Uses || 0 fallback for metric display. Consider using descriptive empty state.

    [zero-data] app\ledger\_components\LedgerTable.tsx
    Uses || 0 fallback for metric display. Consider using descriptive empty state.

    [zero-data] app\signals\[id]\page.tsx
    Uses || 0 fallback for metric display. Consider using descriptive empty state.

  ℹ️ INFO (134):

    [flag-gating] components\AccuracyStats.tsx
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] components\AccuracyStats.tsx
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] components\AccuracyStats.tsx
    References "Yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] components\AccuracyStats.tsx
    References "yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] components\UserSessionPanel.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\clv\page.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\dashboard\page.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\dashboard\page.tsx
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\dashboard\page.tsx
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\dashboard\page.tsx
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\dashboard\page.tsx
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\history\page.tsx
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\history\page.tsx
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\history\page.tsx
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\history\page.tsx
    References "Yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\history\page.tsx
    References "yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\layout.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\layout.tsx
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\layout.tsx
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\performance\page.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\performance\page.tsx
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\performance\page.tsx
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\performance\page.tsx
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\performance\page.tsx
    References "Yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\performance\page.tsx
    References "yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(app)\performance\page.tsx
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(marketing)\_components\CompetitorPositioning.tsx
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(marketing)\_components\LiveStats.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(marketing)\_components\LiveStats.tsx
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(marketing)\_components\LiveStats.tsx
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(marketing)\_components\Pricing.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\(marketing)\_components\TheEdge.tsx
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\admin\page.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\admin\page.tsx
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\data-health\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\data-health\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\health\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\health\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\investor-metrics\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\market-simulation\route.ts
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\model-health\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\model-health\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\model-validation\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\model-validation\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\prediction-validation\route.ts
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\shadow-performance\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\shadow-performance\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\shadow-performance\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\shadow-run\route.ts
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\weekly-model-report\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\weekly-model-report\route.ts
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\admin\weekly-model-report\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\backtest\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\backtest\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\backtest\route.ts
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\backtest\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\backtest\run\route.ts
    References "yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\calibration\registry\route.ts
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\biweekly-model-report\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\biweekly-model-report\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\biweekly-model-report\route.ts
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\capture-odds\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\capture-odds\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\daily-summary\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\daily-summary\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\daily-summary\route.ts
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\daily-summary\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\generate-signals\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\generate-signals\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\generate-signals\route.ts
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\settle\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\settle\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\settle\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\cron\sync-warehouse\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\dashboard\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\dashboard\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\lead-capture\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\market\clv\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\market\clv\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\market\clv\route.ts
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\market\clv\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\market\steam\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\market\steam\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\og\route.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\og\route.tsx
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\performance\clv\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\performance\leagues\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\performance\leagues\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\performance\markets\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\performance\markets\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\performance\route.ts
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\performance\route.ts
    References "Yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\performance\summary\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\performance\summary\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\performance\summary\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\performance\summary\route.ts
    References "yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\performance\summary\route.ts
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\predictions\history\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\results\[id]\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\signals\feed\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\signals\[id]\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\stats\performance\route.ts
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\stats\performance\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\stats\performance\route.ts
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\stats\performance\route.ts
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\stats\performance\route.ts
    References "Yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\stats\performance\route.ts
    References "yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\api\v1\edges\route.ts
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\competitions\_components\CompetitionsList.tsx
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\competitions\_components\CompetitionsList.tsx
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\competitions\_components\CompetitionsList.tsx
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\dashboard\shadow\page.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\dashboard\shadow\page.tsx
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\dashboard\shadow\page.tsx
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\dashboard\shadow\page.tsx
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\ledger\page.tsx
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\ledger\_components\LedgerTable.tsx
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\ledger\_components\LedgerTable.tsx
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\ledger\_components\LedgerTable.tsx
    References "Yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\methodology\page.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\methodology\page.tsx
    References "Calibration" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\paper-trading\page.tsx
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\paper-trading\_components\PaperTradingDashboard.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\paper-trading\_components\PaperTradingDashboard.tsx
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\paper-trading\_components\PaperTradingDashboard.tsx
    References "ROI" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\paper-trading\_components\PaperTradingDashboard.tsx
    References "roi" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\paper-trading\_components\PaperTradingDashboard.tsx
    References "Yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\pricing\page.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\signals\page.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\signals\[id]\page.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\signals\[id]\page.tsx
    References "clv" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\signals\[id]\page.tsx
    References "yield" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\track-record\page.tsx
    References "CLV" but no feature flag check detected. Verify it's properly gated.

    [flag-gating] app\track-record\page.tsx
    References "clv" but no feature flag check detected. Verify it's properly gated.

  ⚠️ PASSED WITH WARNINGS — Review warnings before release.
=========================================================