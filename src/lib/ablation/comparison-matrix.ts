import { ComparisonResult } from './types';

export class ComparisonMatrix {
  /**
   * Generates a comparative ablation markdown table displaying metrics across variants.
   * Bold-highlights and adds trophies to the best-performing models per metric.
   * 
   * @param results Array of baseline and variant comparison outputs
   */
  public static generate(results: ComparisonResult[]): string {
    if (results.length === 0) return 'No evaluation results available.';

    let markdown = '| Model / Variant | Features | Win Rate | ROI | Brier Score | CLV |\n';
    markdown += '|---|---|---|---|---|---|\n';

    // Find optimal metric bounds to identify winners
    let bestWinRate = -Infinity;
    let bestRoi = -Infinity;
    let bestBrier = Infinity;
    let bestClv = -Infinity;

    for (const r of results) {
      if (r.metrics.totalPredictions > 0) {
        if (r.metrics.winRate > bestWinRate) bestWinRate = r.metrics.winRate;
        if (r.metrics.roi > bestRoi) bestRoi = r.metrics.roi;
        if (r.metrics.avgBrierScore < bestBrier) bestBrier = r.metrics.avgBrierScore;
        if (r.metrics.avgCLV > bestClv) bestClv = r.metrics.avgCLV;
      }
    }

    for (const r of results) {
      const total = r.metrics.totalPredictions;
      const isBestWin = total > 0 && r.metrics.winRate === bestWinRate;
      const isBestRoi = total > 0 && r.metrics.roi === bestRoi;
      const isBestBrier = total > 0 && r.metrics.avgBrierScore === bestBrier;
      const isBestClv = total > 0 && r.metrics.avgCLV === bestClv;

      const renderVal = (val: number, isBest: boolean, isPct: boolean = false, isBrier: boolean = false) => {
        if (total === 0) return 'N/A';
        const str = isPct 
          ? `${val.toFixed(2)}%`
          : isBrier
            ? val.toFixed(4)
            : val.toFixed(2);
        return isBest ? `**${str}** 🏆` : str;
      };

      const winRateStr = renderVal(r.metrics.winRate * 100, isBestWin, true);
      const roiStr = renderVal(r.metrics.roi, isBestRoi, true);
      const brierStr = renderVal(r.metrics.avgBrierScore, isBestBrier, false, true);
      const clvStr = renderVal(r.metrics.avgCLV, isBestClv, true);

      markdown += `| ${r.variant} | ${r.featureVersion} | ${winRateStr} | ${roiStr} | ${brierStr} | ${clvStr} |\n`;
    }

    return markdown;
  }
}
