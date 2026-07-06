// HandicapLab Live Data Platform - Odds Normalizer
// Location: src/lib/data-platform/oddsNormalizer.ts

export type OddsFormat = 'Decimal' | 'HongKong' | 'Malay' | 'Indonesian' | 'American' | 'Fractional';

export class OddsNormalizer {
  /**
   * Normalizes any supported odds format to Decimal odds.
   */
  public static toDecimal(odds: any, format: OddsFormat): number {
    if (format === 'Decimal') {
      const num = Number(odds);
      if (isNaN(num)) throw new Error('Invalid Decimal odds format');
      return num;
    }

    if (format === 'HongKong') {
      const hk = Number(odds);
      if (isNaN(hk)) throw new Error('Invalid HongKong odds format');
      return Number((hk + 1.00).toFixed(4));
    }

    if (format === 'Malay') {
      const mal = Number(odds);
      if (isNaN(mal) || mal === 0) throw new Error('Invalid Malay odds format');
      if (mal > 0) {
        return Number((1 + mal).toFixed(4));
      } else {
        return Number((1 + 1 / Math.abs(mal)).toFixed(4));
      }
    }

    if (format === 'Indonesian') {
      const ind = Number(odds);
      if (isNaN(ind) || ind === 0) throw new Error('Invalid Indonesian odds format');
      if (ind > 0) {
        return Number((1 + ind).toFixed(4));
      } else {
        return Number((1 + 1 / Math.abs(ind)).toFixed(4));
      }
    }

    if (format === 'American') {
      const am = Number(odds);
      if (isNaN(am) || am === 0) throw new Error('Invalid American odds format');
      if (am > 0) {
        return Number((1 + am / 100).toFixed(4));
      } else {
        return Number((1 + 100 / Math.abs(am)).toFixed(4));
      }
    }

    if (format === 'Fractional') {
      if (typeof odds !== 'string') throw new Error('Fractional odds must be a string (e.g. "5/2")');
      const parts = odds.split('/');
      if (parts.length !== 2) throw new Error('Invalid Fractional odds format');
      const num = Number(parts[0]);
      const den = Number(parts[1]);
      if (isNaN(num) || isNaN(den) || den === 0) throw new Error('Invalid Fractional odds math');
      return Number((num / den + 1.00).toFixed(4));
    }

    throw new Error(`Unsupported odds format: ${format}`);
  }
}
