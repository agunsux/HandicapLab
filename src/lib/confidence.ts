export function mapConfidence(probability: number): string {
  if (probability >= 0.75) return '🟢 High';
  if (probability >= 0.55) return '🟡 Medium';
  if (probability >= 0.40) return '⚪ Low';
  return '🔴 Avoid';
}
