// ============================================================================
// FEATURE FLAG SYSTEM  (Epic 31A — User refinement)
// ============================================================================
// No new feature may become visible to users unless its feature flag is
// explicitly enabled. This allows CLV, ROI, Scanner, Premium features, etc.
// to be developed and tested in production without prematurely exposing them.
//
// Rules:
//   1. Every new feature MUST have a corresponding flag.
//   2. Features default to DISABLED (false) in production.
//   3. Flags are evaluated at runtime — no dead code deployment needed.
//   4. Dashboard components MUST check the flag before rendering premium metrics.
// ============================================================================

export type FeatureFlagName =
  | 'clv_calculation'
  | 'performance_ledger'
  | 'odds_ingestion_live'
  | 'odds_ingestion_historical'
  | 'settlement_automation'
  | 'de_vig_engine'
  | 'model_calibration_ui'
  | 'premium_predictions'
  | 'market_scanner'
  | 'audit_panel'
  | 'paper_trading_v2'
  | 'edge_analysis';

/** Feature flag configuration */
export interface FeatureFlag {
  name: FeatureFlagName;
  enabled: boolean;
  description: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  /** Optional: percentage rollout (0-100) for gradual enablement */
  rolloutPercentage?: number;
  /** Optional: tier gating (free, starter, pro, quant) */
  minTier?: 'free' | 'starter' | 'pro' | 'quant';
  /** Optional: list of user IDs for beta testing */
  betaUserIds?: string[];
}

/**
 * Feature flag registry — the single source of truth for what features
 * are active. Loaded from configuration at boot time.
 */
export class FeatureFlagRegistry {
  private flags: Map<FeatureFlagName, FeatureFlag> = new Map();

  constructor(initialFlags?: FeatureFlag[]) {
    if (initialFlags) {
      for (const flag of initialFlags) {
        this.flags.set(flag.name, flag);
      }
    }
  }

  /** Register or update a feature flag */
  set(flag: FeatureFlag): void {
    this.flags.set(flag.name, {
      ...flag,
      updatedAt: new Date().toISOString(),
    });
  }

  /** Check if a feature is enabled (base check, no tier/rollout) */
  isEnabled(name: FeatureFlagName): boolean {
    return this.flags.get(name)?.enabled ?? false;
  }

  /** Full check: enabled + tier eligibility + rollout + beta */
  isAccessible(
    name: FeatureFlagName,
    context?: {
      userId?: string;
      userTier?: 'free' | 'starter' | 'pro' | 'quant';
    }
  ): boolean {
    const flag = this.flags.get(name);
    if (!flag || !flag.enabled) return false;

    // Check tier gating
    if (flag.minTier && context?.userTier) {
      const tierLevel: Record<string, number> = { free: 0, starter: 1, pro: 2, quant: 3 };
      if ((tierLevel[context.userTier] ?? 0) < (tierLevel[flag.minTier] ?? 0)) {
        return false;
      }
    }

    // Check beta user list
    if (flag.betaUserIds && flag.betaUserIds.length > 0 && context?.userId) {
      if (!flag.betaUserIds.includes(context.userId)) {
        return false;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100 && context?.userId) {
      // Deterministic hash-based rollout
      const hash = simpleHash(context.userId + name) % 100;
      if (hash >= flag.rolloutPercentage) {
        return false;
      }
    }

    return true;
  }

  /** Get full flag details */
  get(name: FeatureFlagName): FeatureFlag | undefined {
    return this.flags.get(name);
  }

  /** Get all registered flags */
  getAll(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /** Get all enabled flags */
  getEnabled(): FeatureFlag[] {
    return this.getAll().filter((f) => f.enabled);
  }

  /** Disable a flag */
  disable(name: FeatureFlagName): void {
    const flag = this.flags.get(name);
    if (flag) {
      this.flags.set(name, { ...flag, enabled: false, updatedAt: new Date().toISOString() });
    }
  }

  /** Enable a flag */
  enable(name: FeatureFlagName): void {
    const flag = this.flags.get(name);
    if (flag) {
      this.flags.set(name, { ...flag, enabled: true, updatedAt: new Date().toISOString() });
    } else {
      this.flags.set(name, {
        name,
        enabled: true,
        description: '',
        owner: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Default production flags — all new features default to DISABLED.
 * Only foundational infrastructure (de_vig_engine) is enabled by default.
 */
export const DEFAULT_PRODUCTION_FLAGS: FeatureFlag[] = [
  {
    name: 'de_vig_engine',
    enabled: true,
    description: 'De-vig (margin removal) engine for fair probability calculation',
    owner: 'core',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'clv_calculation',
    enabled: false,
    description: 'Closing Line Value calculation and display',
    owner: 'core',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    minTier: 'pro',
  },
  {
    name: 'performance_ledger',
    enabled: false,
    description: 'Performance ledger with ROI, yield, max drawdown metrics',
    owner: 'core',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    minTier: 'starter',
  },
  {
    name: 'odds_ingestion_live',
    enabled: false,
    description: 'Live odds ingestion from external providers',
    owner: 'infrastructure',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'odds_ingestion_historical',
    enabled: false,
    description: 'Historical odds ingestion for backtesting',
    owner: 'infrastructure',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'settlement_automation',
    enabled: false,
    description: 'Automated settlement of finished matches',
    owner: 'infrastructure',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'model_calibration_ui',
    enabled: false,
    description: 'Model calibration curve display and reliability diagrams',
    owner: 'ml',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    minTier: 'pro',
  },
  {
    name: 'premium_predictions',
    enabled: false,
    description: 'Premium-tier prediction insights and explanations',
    owner: 'product',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    minTier: 'pro',
  },
  {
    name: 'market_scanner',
    enabled: false,
    description: 'Real-time market scanner for edge detection',
    owner: 'product',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    minTier: 'quant',
  },
  {
    name: 'audit_panel',
    enabled: false,
    description: 'Internal audit panel for data provenance and integrity checks',
    owner: 'core',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'paper_trading_v2',
    enabled: false,
    description: 'Paper trading v2 with Kelly staking and portfolio tracking',
    owner: 'product',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    minTier: 'pro',
  },
  {
    name: 'edge_analysis',
    enabled: false,
    description: 'Edge analysis tools with expected value breakdowns',
    owner: 'ml',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    minTier: 'starter',
  },
];