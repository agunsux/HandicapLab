// HandicapLab Data Platform - Model Card Generator
import * as fs from 'fs';
import * as path from 'path';

export interface ModelCardData {
  modelName: string;
  version: string;
  description: string;
  architecture: string;
  hyperparameters: Record<string, any>;
  dataset: {
    name: string;
    description: string;
    trainingWindow: string;
    testingWindow: string;
    featureSet: string[];
  };
  performance: {
    logLoss: number;
    brierScore: number;
    rocAuc: number;
    prAuc: number;
    ece: number;
    mce: number;
  };
  businessImpact: {
    flatROI: number;
    kellyROI: number;
    maxDrawdown: number;
    clvAverage: number;
    positiveCLVPercent: number;
  };
  limitations: string[];
  ethicalConsiderations: string[];
  creationDate: string;
}

export class ModelCardGenerator {
  /**
   * Generates a Markdown Model Card
   */
  public static generateMarkdown(data: ModelCardData): string {
    return `# Model Card: ${data.modelName} (v${data.version})
Generated: ${data.creationDate}

## 1. Model Details
* **Description**: ${data.description}
* **Architecture**: ${data.architecture}
* **Hyperparameters**: \`\`\`json\n${JSON.stringify(data.hyperparameters, null, 2)}\n\`\`\`

## 2. Intended Use & Limitations
* **Intended Use**: Football match outcome prediction for closing line value estimation and betting edge discovery.
* **Limitations**:
${data.limitations.map(l => `  * ${l}`).join('\n')}
* **Ethical Considerations**:
${data.ethicalConsiderations.map(e => `  * ${e}`).join('\n')}

## 3. Training & Evaluation Data
* **Dataset**: ${data.dataset.name} - ${data.dataset.description}
* **Training Window**: ${data.dataset.trainingWindow}
* **Testing Window**: ${data.dataset.testingWindow}
* **Feature Set**: ${data.dataset.featureSet.join(', ')}

## 4. Quantitative Analysis

### 4.1 Statistical Performance
| Metric | Value |
|--------|-------|
| LogLoss | ${data.performance.logLoss.toFixed(4)} |
| Brier Score | ${data.performance.brierScore.toFixed(4)} |
| ROC-AUC | ${data.performance.rocAuc.toFixed(4)} |
| PR-AUC | ${data.performance.prAuc.toFixed(4)} |
| ECE (Expected Calibration Error) | ${data.performance.ece.toFixed(4)} |
| MCE (Maximum Calibration Error) | ${data.performance.mce.toFixed(4)} |

### 4.2 Business Impact (Simulated)
| Metric | Value |
|--------|-------|
| Flat Stake ROI | ${(data.businessImpact.flatROI * 100).toFixed(2)}% |
| Kelly Stake ROI | ${(data.businessImpact.kellyROI * 100).toFixed(2)}% |
| Max Drawdown | ${(data.businessImpact.maxDrawdown * 100).toFixed(2)}% |
| Average CLV | ${(data.businessImpact.clvAverage * 100).toFixed(2)}% |
| Bets w/ Positive CLV | ${(data.businessImpact.positiveCLVPercent * 100).toFixed(2)}% |

`;
  }

  /**
   * Generates and writes the Model Card to disk.
   */
  public static export(data: ModelCardData, outputPath: string): void {
    const markdown = this.generateMarkdown(data);
    fs.writeFileSync(outputPath, markdown);
  }
}
