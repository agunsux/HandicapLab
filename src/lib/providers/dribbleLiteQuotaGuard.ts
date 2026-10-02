/**
 * DRIBBLE360 LITE-MODE QUOTA GUARD & SIMULATION ENGINE
 * 
 * Enforces an internal provider budget simulating the $19/month Lite plan:
 *   - DRIBBLE_SIMULATED_PLAN = 'LITE'
 *   - MONTHLY_BUDGET = 500-equivalent requests/credits
 * 
 * Safety & Billing Rules:
 *   - Enforced BEFORE making any network requests.
 *   - If simulated budget is exhausted: STOP immediately.
 *   - Elite access is NEVER used as justification to exceed simulated budget.
 *   - Zero billing manipulation or provider spoofing.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface DribbleLiteQuotaState {
  plan: 'LITE';
  monthlyBudget: number;
  consumed: number;
  reserved: number;
  lastUpdatedUtc: string;
}

export interface DribbleLiteQuotaRecord {
  timestamp: string;
  endpoint: string;
  purpose: string;
  cost: number;
  budget_initial: number;
  budget_reserved: number;
  budget_consumed: number;
  budget_remaining: number;
  action: 'RESERVE' | 'CONFIRM' | 'ROLLBACK' | 'BLOCKED';
  reservationId?: string;
}

export interface ReservationReceipt {
  ok: boolean;
  reservationId?: string;
  cost: number;
  budgetRemaining: number;
  reason?: string;
}

export class DribbleLiteQuotaGuard {
  public static readonly PLAN = 'LITE';
  public static readonly DEFAULT_MONTHLY_BUDGET = 500;

  private static stateFile = path.resolve('data/research/dribble360/dribble_lite_simulation_state.json');
  private static ledgerFile = path.resolve('data/research/dribble360/dribble_lite_quota_ledger.jsonl');

  private static activeReservations = new Map<string, { cost: number; endpoint: string; purpose: string; timestamp: string }>();

  /**
   * Loads current persistent state or initializes a new simulated budget of 500.
   */
  public static getState(): DribbleLiteQuotaState {
    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = fs.readFileSync(this.stateFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.plan === 'LITE' && typeof parsed.consumed === 'number') {
          return {
            plan: 'LITE',
            monthlyBudget: parsed.monthlyBudget ?? this.DEFAULT_MONTHLY_BUDGET,
            consumed: parsed.consumed,
            reserved: parsed.reserved ?? 0,
            lastUpdatedUtc: parsed.lastUpdatedUtc ?? new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.warn('[DribbleLiteQuotaGuard] Failed to read state file, initializing fresh budget:', err);
    }

    const initialState: DribbleLiteQuotaState = {
      plan: 'LITE',
      monthlyBudget: this.DEFAULT_MONTHLY_BUDGET,
      consumed: 0,
      reserved: 0,
      lastUpdatedUtc: new Date().toISOString(),
    };
    this.saveState(initialState);
    return initialState;
  }

  /**
   * Resets simulation state to initial budget (500) for testing or new simulation runs.
   */
  public static resetSimulation(budget = this.DEFAULT_MONTHLY_BUDGET): DribbleLiteQuotaState {
    const freshState: DribbleLiteQuotaState = {
      plan: 'LITE',
      monthlyBudget: budget,
      consumed: 0,
      reserved: 0,
      lastUpdatedUtc: new Date().toISOString(),
    };
    this.activeReservations.clear();
    this.saveState(freshState);
    return freshState;
  }

  private static saveState(state: DribbleLiteQuotaState): void {
    try {
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
      console.error('[DribbleLiteQuotaGuard] Failed to persist state:', err);
    }
  }

  private static appendLedger(record: DribbleLiteQuotaRecord): void {
    try {
      const dir = path.dirname(this.ledgerFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(this.ledgerFile, JSON.stringify(record) + '\n', 'utf8');
    } catch (err) {
      console.error('[DribbleLiteQuotaGuard] Failed to append ledger record:', err);
    }
  }

  /**
   * Checks whether the simulated budget can afford a request of `cost`.
   */
  public static canAfford(cost = 1): { allowed: boolean; remaining: number; reason?: string } {
    const state = this.getState();
    const allocated = state.consumed + state.reserved;
    const remaining = Math.max(0, state.monthlyBudget - allocated);

    if (remaining < cost) {
      return {
        allowed: false,
        remaining,
        reason: `LITE_BUDGET_EXHAUSTED: Requires ${cost} credit(s), but only ${remaining} remaining out of ${state.monthlyBudget}. STOP.`,
      };
    }

    return { allowed: true, remaining };
  }

  /**
   * Atomically reserves budget BEFORE any request execution.
   */
  public static reserve(endpoint: string, purpose: string, cost = 1): ReservationReceipt {
    const state = this.getState();
    const check = this.canAfford(cost);

    if (!check.allowed) {
      this.appendLedger({
        timestamp: new Date().toISOString(),
        endpoint,
        purpose,
        cost,
        budget_initial: state.monthlyBudget,
        budget_reserved: state.reserved,
        budget_consumed: state.consumed,
        budget_remaining: check.remaining,
        action: 'BLOCKED',
      });

      return {
        ok: false,
        cost,
        budgetRemaining: check.remaining,
        reason: check.reason,
      };
    }

    const reservationId = crypto.randomUUID();
    state.reserved += cost;
    state.lastUpdatedUtc = new Date().toISOString();
    this.saveState(state);

    this.activeReservations.set(reservationId, {
      cost,
      endpoint,
      purpose,
      timestamp: new Date().toISOString(),
    });

    const budgetRemaining = Math.max(0, state.monthlyBudget - (state.consumed + state.reserved));

    this.appendLedger({
      timestamp: new Date().toISOString(),
      endpoint,
      purpose,
      cost,
      budget_initial: state.monthlyBudget,
      budget_reserved: state.reserved,
      budget_consumed: state.consumed,
      budget_remaining: budgetRemaining,
      action: 'RESERVE',
      reservationId,
    });

    return {
      ok: true,
      reservationId,
      cost,
      budgetRemaining,
    };
  }

  /**
   * Confirms consumption after request execution.
   */
  public static confirm(reservationId: string, actualCost?: number): void {
    const active = this.activeReservations.get(reservationId);
    const costToCharge = actualCost ?? active?.cost ?? 1;
    const originalReserved = active?.cost ?? costToCharge;

    const state = this.getState();
    state.reserved = Math.max(0, state.reserved - originalReserved);
    state.consumed += costToCharge;
    state.lastUpdatedUtc = new Date().toISOString();
    this.saveState(state);

    this.activeReservations.delete(reservationId);

    const budgetRemaining = Math.max(0, state.monthlyBudget - (state.consumed + state.reserved));

    this.appendLedger({
      timestamp: new Date().toISOString(),
      endpoint: active?.endpoint ?? 'unknown',
      purpose: active?.purpose ?? 'unknown',
      cost: costToCharge,
      budget_initial: state.monthlyBudget,
      budget_reserved: state.reserved,
      budget_consumed: state.consumed,
      budget_remaining: budgetRemaining,
      action: 'CONFIRM',
      reservationId,
    });
  }

  /**
   * Rolls back a reservation if request fails before execution or was rejected.
   */
  public static rollback(reservationId: string): void {
    const active = this.activeReservations.get(reservationId);
    if (!active) return;

    const state = this.getState();
    state.reserved = Math.max(0, state.reserved - active.cost);
    state.lastUpdatedUtc = new Date().toISOString();
    this.saveState(state);

    this.activeReservations.delete(reservationId);

    const budgetRemaining = Math.max(0, state.monthlyBudget - (state.consumed + state.reserved));

    this.appendLedger({
      timestamp: new Date().toISOString(),
      endpoint: active.endpoint,
      purpose: active.purpose,
      cost: active.cost,
      budget_initial: state.monthlyBudget,
      budget_reserved: state.reserved,
      budget_consumed: state.consumed,
      budget_remaining: budgetRemaining,
      action: 'ROLLBACK',
      reservationId,
    });
  }

  /**
   * Returns current budget metrics for logging and UI.
   */
  public static getMetrics(): {
    budget_initial: number;
    budget_reserved: number;
    budget_consumed: number;
    budget_remaining: number;
    utilization_pct: number;
    plan: string;
  } {
    const state = this.getState();
    const allocated = state.consumed + state.reserved;
    const remaining = Math.max(0, state.monthlyBudget - allocated);
    const utilizationPct = state.monthlyBudget > 0 ? (allocated / state.monthlyBudget) * 100 : 0;

    return {
      budget_initial: state.monthlyBudget,
      budget_reserved: state.reserved,
      budget_consumed: state.consumed,
      budget_remaining: remaining,
      utilization_pct: Math.round(utilizationPct * 100) / 100,
      plan: state.plan,
    };
  }

  /**
   * Formats a human-readable summary box matching the prompt specification.
   */
  public static formatStatusBox(): string {
    const m = this.getMetrics();
    return [
      'Lite Simulation',
      '---------------',
      `Plan:      ${m.plan} ($19/mo)`,
      `Budget:    ${m.budget_initial}`,
      `Used:      ${m.budget_consumed}`,
      `Reserved:  ${m.budget_reserved}`,
      `Remaining: ${m.budget_remaining}`,
      `Usage:     ${m.utilization_pct}%`,
    ].join('\n');
  }
}

export default DribbleLiteQuotaGuard;
