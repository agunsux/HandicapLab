/**
 * Bankroll & 1-Unit Risk Management Engine
 *
 * Enforces the core HandicapLab principle:
 * 1u = Bankroll * RiskPct (strictly calibrated between 1% and 5%).
 * Default: 2.0% risk per unit.
 */

export interface BankrollSettings {
  totalBankroll: number;         // Total active capital (e.g. 10,000 USD)
  unitRiskPct: number;           // Fractional risk: 0.01 (1%) to 0.05 (5%)
}

export const DEFAULT_BANKROLL_SETTINGS: BankrollSettings = {
  totalBankroll: 10000,
  unitRiskPct: 0.02, // 2% flat unit risk
};

/**
 * Calculates currency amount corresponding to 1 Unit (1u).
 * Enforces strict clamping of risk percentage between 1% and 5%.
 */
export function getUnitValue(
  bankroll: number = DEFAULT_BANKROLL_SETTINGS.totalBankroll,
  riskPct: number = DEFAULT_BANKROLL_SETTINGS.unitRiskPct
): number {
  const safeRisk = Math.min(0.05, Math.max(0.01, riskPct));
  return Number((bankroll * safeRisk).toFixed(2));
}

/**
 * Converts unit outcome (e.g. +1.85u or -1.00u) to currency profit/loss.
 */
export function unitsToCurrency(
  units: number,
  bankroll: number = DEFAULT_BANKROLL_SETTINGS.totalBankroll,
  riskPct: number = DEFAULT_BANKROLL_SETTINGS.unitRiskPct
): number {
  const unitValue = getUnitValue(bankroll, riskPct);
  return Number((units * unitValue).toFixed(2));
}

/**
 * Converts currency amount to normalized units (u).
 */
export function currencyToUnits(
  currencyAmount: number,
  bankroll: number = DEFAULT_BANKROLL_SETTINGS.totalBankroll,
  riskPct: number = DEFAULT_BANKROLL_SETTINGS.unitRiskPct
): number {
  const unitValue = getUnitValue(bankroll, riskPct);
  if (unitValue <= 0) return 0;
  return Number((currencyAmount / unitValue).toFixed(4));
}

/**
 * Computes fractional Kelly stake scaled to max allowable 1u-5u bounds.
 */
export function calculateScaledKellyUnits(
  modelProbability: number,
  marketOdds: number,
  fractionalKellyMultiplier: number = 0.25, // Quarter-Kelly standard
  maxUnits: number = 2.5 // Hard ceiling in units
): number {
  if (marketOdds <= 1.0 || modelProbability <= 0) return 0;
  const b = marketOdds - 1;
  const p = modelProbability;
  const q = 1 - p;

  const fullKelly = (b * p - q) / b;
  if (fullKelly <= 0) return 0;

  const fractionalKelly = fullKelly * fractionalKellyMultiplier;
  // Convert to units where 1.0 = 1 full unit base stake
  const rawUnits = fractionalKelly / DEFAULT_BANKROLL_SETTINGS.unitRiskPct;
  return Number(Math.min(maxUnits, Math.max(0.25, rawUnits)).toFixed(2));
}
