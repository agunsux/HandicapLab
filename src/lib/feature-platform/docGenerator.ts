// HandicapLab Feature Platform - Documentation Generator
import { featureRegistry } from './registry';
import * as fs from 'fs';
import * as path from 'path';

export class FeatureDocGenerator {
  public static generate(outputPath: string): void {
    const features = featureRegistry.getAllFeatures();
    
    // Group by category
    const grouped: Record<string, typeof features> = {};
    for (const feat of features) {
      if (!grouped[feat.category]) {
        grouped[feat.category] = [];
      }
      grouped[feat.category].push(feat);
    }

    let markdown = `# HandicapLab Feature Catalog\n\n`;
    markdown += `*Generated automatically from the Feature Registry*\n\n`;
    markdown += `Total Features: **${features.length}**\n\n`;

    for (const [category, categoryFeatures] of Object.entries(grouped)) {
      markdown += `## ${category}\n\n`;
      for (const feat of categoryFeatures) {
        markdown += `### ${feat.name} (\`${feat.id}\`)\n`;
        markdown += `> ${feat.description}\n\n`;
        markdown += `- **Formula:** \`${feat.formula}\`\n`;
        markdown += `- **Leakage Classification:** ${feat.leakageClassification === 'Safe' ? '✅ Safe' : feat.leakageClassification === 'Warning' ? '⚠️ Warning' : '❌ Unsafe'} *(Reason: ${feat.leakageReasoning})*\n`;
        markdown += `- **Time Travel Policy:** ${feat.timeTravelPolicy}\n`;
        markdown += `- **Data Type:** ${feat.dataType} | **Unit:** ${feat.unit}\n`;
        markdown += `- **Source:** ${feat.source.join(', ')}\n`;
        markdown += `- **Dependencies:** ${feat.dependencies.length ? feat.dependencies.map(d => '\`' + d + '\`').join(', ') : 'None'}\n`;
        markdown += `- **Version:** ${feat.version} (Formula: v${feat.formulaVersion}, Dep: v${feat.dependencyVersion})\n`;
        markdown += `- **Owner:** ${feat.owner}\n\n`;
      }
    }

    fs.writeFileSync(outputPath, markdown);
  }
}
