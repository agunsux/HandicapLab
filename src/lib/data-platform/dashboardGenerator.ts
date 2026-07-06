// HandicapLab Data Platform - Apache ECharts Dashboard Generator
import * as fs from 'fs';
import * as path from 'path';

export class DashboardGenerator {
  /**
   * Generates an HTML dashboard using Apache ECharts.
   */
  public static generateDashboard(
    bankrollHistory: number[],
    reliabilityCurveData: { avgProbability: number, avgOutcome: number }[],
    featureImportance: { name: string, score: number }[],
    outputPath: string
  ): void {
    
    // Prepare ECharts options
    const bankrollOption = {
      title: { text: 'Simulated Bankroll Progression (Kelly)' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', boundaryGap: false },
      yAxis: { type: 'value', min: 'dataMin' },
      series: [{
        data: bankrollHistory,
        type: 'line',
        areaStyle: {},
        smooth: true,
        itemStyle: { color: '#00FA9A' }
      }]
    };

    const reliabilityOption = {
      title: { text: 'Calibration Reliability Curve' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'value', min: 0, max: 1, name: 'Predicted Probability' },
      yAxis: { type: 'value', min: 0, max: 1, name: 'Empirical Probability' },
      series: [
        {
          name: 'Perfect Calibration',
          type: 'line',
          data: [[0, 0], [1, 1]],
          lineStyle: { type: 'dashed', color: '#999' }
        },
        {
          name: 'Model',
          type: 'line',
          data: reliabilityCurveData.map(d => [d.avgProbability, d.avgOutcome]),
          itemStyle: { color: '#FF4500' },
          symbol: 'circle',
          symbolSize: 8
        }
      ]
    };

    const featureOption = {
      title: { text: 'Permutation Feature Importance' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: featureImportance.map(f => f.name).reverse() },
      series: [{
        type: 'bar',
        data: featureImportance.map(f => f.score).reverse(),
        itemStyle: { color: '#1E90FF' }
      }]
    };

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HandicapLab Scientific Benchmark Dashboard</title>
    <!-- Apache ECharts -->
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #0d1117; color: #c9d1d9; margin: 0; padding: 20px; }
        h1 { text-align: center; color: #58a6ff; }
        .chart-container { width: 100%; max-width: 1200px; height: 500px; margin: 20px auto; background: #161b22; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
    </style>
</head>
<body>
    <h1>Benchmark Dashboard</h1>
    
    <div id="bankrollChart" class="chart-container"></div>
    <div id="reliabilityChart" class="chart-container"></div>
    <div id="featureChart" class="chart-container"></div>

    <script>
        var bankrollChart = echarts.init(document.getElementById('bankrollChart'), 'dark');
        var reliabilityChart = echarts.init(document.getElementById('reliabilityChart'), 'dark');
        var featureChart = echarts.init(document.getElementById('featureChart'), 'dark');

        bankrollChart.setOption(${JSON.stringify(bankrollOption)});
        reliabilityChart.setOption(${JSON.stringify(reliabilityOption)});
        featureChart.setOption(${JSON.stringify(featureOption)});

        window.addEventListener('resize', function() {
            bankrollChart.resize();
            reliabilityChart.resize();
            featureChart.resize();
        });
    </script>
</body>
</html>
    `;

    fs.writeFileSync(outputPath, htmlContent);
  }
}
