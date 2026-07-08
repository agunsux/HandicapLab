import { ExplanationObject, ExplanationFormat } from './types';

export class ExplanationFormatter {
  /**
   * Formats the ExplanationObject into the desired format.
   * JSON: Full source of truth.
   * Text/Markdown: Human-readable narrative representations.
   */
  static format(explanation: ExplanationObject, format: ExplanationFormat): string {
    if (format === 'json') {
      return JSON.stringify(explanation, null, 2);
    }

    const n = explanation.narrative;
    const isMarkdown = format === 'markdown';

    const b = (text: string) => isMarkdown ? `**${text}**` : text;
    const h1 = (text: string) => isMarkdown ? `# ${text}\n` : `${text.toUpperCase()}\n`;
    const h2 = (text: string) => isMarkdown ? `## ${text}\n` : `\n--- ${text.toUpperCase()} ---\n`;
    const bullet = isMarkdown ? '-' : '•';

    let out = h1(`Decision Explanation: ${explanation.decisionId}`);
    
    out += `\n${b('Summary:')} ${n.summary}\n`;
    out += `\n${b('Generated:')} ${explanation.generatedAt.toISOString()}`;
    out += `\n${b('Completeness Score:')} ${explanation.completenessScore}%\n`;

    out += h2('1. Decision Reasoning');
    out += `${n.decisionReason}\n`;

    out += h2('2. Confidence Analysis');
    out += `${n.confidenceReason}\n`;

    out += h2('3. Uncertainty Profile');
    out += `${n.uncertaintyReason}\n`;

    out += h2('4. Evidence Summary');
    out += `${n.evidenceSummary}\n`;

    const features = explanation.structured.featureContributions;
    if (features.status === 'AVAILABLE' && features.factors.length > 0) {
      out += h2('5. Top Feature Contributions');
      const top3 = features.factors.slice(0, 3);
      for (const f of top3) {
        const dir = f.direction === 'POSITIVE' ? '(+)' : '(-)';
        out += `${bullet} ${f.name} ${dir}: ${(f.contribution * 100).toFixed(1)}%\n`;
      }
    } else {
      out += h2('5. Feature Contributions');
      out += `${bullet} Status: ${features.status}`;
      if (features.reason) out += ` (Reason: ${features.reason})\n`;
      else out += '\n';
    }

    return out;
  }
}
