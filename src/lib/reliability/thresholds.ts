// Centralized SLO/SLI Threshold Configuration
// Location: src/lib/reliability/thresholds.ts

export const SLO_THRESHOLDS = {
  database: {
    latency_ms: 200,
  },
  prediction: {
    age_seconds: 300, // Freshness: predictions created < 5 mins ago
  },
  market: {
    age_seconds: 120, // Freshness: market snapshots updated < 2 mins ago
  },
  settlement: {
    delay_seconds: 600, // Freshness: last successful settlement run < 10 mins ago
  },
  billing: {
    latency_ms: 500,
  },
  storage: {
    latency_ms: 300,
  }
};
