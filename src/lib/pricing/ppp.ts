/**
 * HandicapLab PPP (Purchasing Power Parity) Pricing Architecture.
 *
 * Prices adjust automatically by country based on World Bank PPP conversion
 * factors. The adjustment is applied transparently and never exposed
 * aggressively. A manual override is supported for edge cases.
 *
 * Design principles:
 * - English/USD is the baseline.
 * - PPP factor is clamped to a sane range (e.g. 0.35x - 1.0x) to avoid
 *   extreme discounts or inflated prices.
 * - The displayed price is always rounded to a clean number.
 * - Manual override (via profile setting) takes precedence over geo detection.
 */

export interface PppConfig {
  /** ISO 3166-1 alpha-2 country code */
  country: string;
  /** PPP conversion factor relative to USD (1.0 = US baseline) */
  factor: number;
  /** Whether this country is eligible for PPP pricing */
  eligible: boolean;
}

/**
 * World Bank PPP conversion factors (relative to USD, 1.0 = US).
 * These are illustrative baseline values; in production these should be
 * sourced from a maintained dataset (e.g. World Bank API or a bundled table).
 */
const PPP_FACTORS: Record<string, number> = {
  US: 1.0,
  GB: 0.9,
  DE: 0.85,
  FR: 0.85,
  ES: 0.75,
  IT: 0.75,
  NL: 0.85,
  ID: 0.4,
  IN: 0.35,
  CN: 0.55,
  BR: 0.5,
  MX: 0.55,
  TR: 0.45,
  VN: 0.4,
  TH: 0.5,
  PH: 0.45,
  MY: 0.55,
  SG: 0.95,
  AU: 0.95,
  CA: 0.95,
  JP: 0.9,
  KR: 0.85,
  AR: 0.5,
  CL: 0.55,
  CO: 0.5,
  PE: 0.5,
  NG: 0.4,
  KE: 0.4,
  ZA: 0.55,
  EG: 0.45,
  SA: 0.8,
  AE: 0.9,
  PK: 0.35,
  BD: 0.35,
  LK: 0.4,
  NP: 0.35,
};

/** Clamp factors to avoid extreme discounts or inflation. */
const MIN_FACTOR = 0.35;
const MAX_FACTOR = 1.0;

/** Countries that are NOT eligible for PPP pricing (e.g. high-income). */
const INELIGIBLE_COUNTRIES = new Set(['US', 'GB', 'DE', 'FR', 'NL', 'AU', 'CA', 'SG', 'AE', 'SA', 'CH', 'NO', 'SE', 'DK', 'FI', 'AT', 'BE', 'IE', 'NZ', 'IL', 'JP', 'KR']);

export function getPppFactor(country: string): number {
  const code = country.trim().toUpperCase();
  const raw = PPP_FACTORS[code] ?? 1.0;
  return Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, raw));
}

export function isPppEligible(country: string): boolean {
  const code = country.trim().toUpperCase();
  return !INELIGIBLE_COUNTRIES.has(code);
}

/**
 * Compute the PPP-adjusted price for a USD base price.
 * Returns the adjusted price rounded to a clean number.
 */
export function applyPpp(basePriceUSD: number, country: string): number {
  if (!isPppEligible(country)) {
    return basePriceUSD;
  }
  const factor = getPppFactor(country);
  const adjusted = basePriceUSD * factor;
  return roundToClean(adjusted);
}

/**
 * Round to a clean, human-friendly number (e.g. 9, 12, 15, 19, 29).
 */
function roundToClean(value: number): number {
  if (value <= 0) return 0;
  if (value < 10) return Math.max(1, Math.round(value));
  if (value < 20) return Math.round(value / 2) * 2;
  if (value < 50) return Math.round(value / 5) * 5;
  return Math.round(value / 10) * 10;
}

export interface PppPriceResult {
  basePriceUSD: number;
  adjustedPrice: number;
  country: string;
  factor: number;
  eligible: boolean;
  /** Whether the price was actually adjusted (differs from base). */
  adjusted: boolean;
}

/**
 * Resolve the final price for a plan given a country.
 * Supports manual override via the `overrideFactor` parameter.
 */
export function resolvePppPrice(
  basePriceUSD: number,
  country: string,
  overrideFactor?: number
): PppPriceResult {
  const eligible = isPppEligible(country);
  const factor = overrideFactor ?? getPppFactor(country);
  const adjusted = eligible && factor < 1.0;
  const price = adjusted ? roundToClean(basePriceUSD * factor) : basePriceUSD;

  return {
    basePriceUSD,
    adjustedPrice: price,
    country: country.trim().toUpperCase(),
    factor,
    eligible,
    adjusted,
  };
}

/**
 * Format a price in a locale-aware way.
 */
export function formatPrice(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
