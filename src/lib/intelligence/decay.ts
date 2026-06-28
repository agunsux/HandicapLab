export interface HealthMetrics {
  roi: number;
  clv: number;
  winRate: number;
  sampleSize: number;
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'degraded';
  rolling30: HealthMetrics;
  rolling100: HealthMetrics;
}

export class StrategyDecayMonitor {
  /**
   * Calculates metrics for a subset of signals.
   */
  private static calculateMetrics(signals: any[]): HealthMetrics {
    const sampleSize = signals.length;
    if (sampleSize === 0) {
      return { roi: 0, clv: 0, winRate: 0, sampleSize: 0 };
    }

    let wins = 0;
    let totalRoi = 0;
    let totalClv = 0;

    for (const sig of signals) {
      const isWin = sig.status === 'won';
      const isLoss = sig.status === 'lost';
      const odds = Number(sig.odds || 1.95);
      const clv = Number(sig.clv_percentage !== null ? sig.clv_percentage : (sig.clv !== null ? sig.clv * 100 : 0));

      if (isWin) {
        wins++;
        totalRoi += (odds - 1.0) * 100;
      } else if (isLoss) {
        totalRoi -= 100.0;
      }
      totalClv += clv;
    }

    return {
      roi: Number((totalRoi / sampleSize).toFixed(2)),
      clv: Number((totalClv / sampleSize).toFixed(2)),
      winRate: Number(((wins / sampleSize) * 100).toFixed(2)),
      sampleSize
    };
  }

  /**
   * Analyzes rolling 30 and 100 windows to determine health status.
   */
  public static evaluateHealth(settledSignals: any[]): HealthStatus {
    // Ensure signals are sorted descending (most recent first)
    const sorted = [...settledSignals].sort((a, b) => {
      const timeA = new Date(a.settled_at || a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.settled_at || b.updated_at || b.created_at).getTime();
      return timeB - timeA;
    });

    const slice30 = sorted.slice(0, 30);
    const slice100 = sorted.slice(0, 100);

    const rolling30 = this.calculateMetrics(slice30);
    const rolling100 = this.calculateMetrics(slice100);

    let status: 'healthy' | 'warning' | 'degraded' = 'healthy';

    // Degraded rules (using rolling 100 if we have enough sample, else rolling 30)
    if (rolling100.sampleSize >= 30) {
      if (rolling100.roi < -5.0 || rolling100.clv < -1.0 || rolling100.winRate < 45.0) {
        status = 'degraded';
      } else if (rolling100.roi < 0.0 || rolling100.clv < 0.5 || rolling100.winRate < 48.0) {
        status = 'warning';
      }
    } else if (rolling30.sampleSize >= 10) {
      if (rolling30.roi < -10.0 || rolling30.clv < -2.0 || rolling30.winRate < 40.0) {
        status = 'degraded';
      } else if (rolling30.roi < -2.0 || rolling30.clv < 0.0 || rolling30.winRate < 46.0) {
        status = 'warning';
      }
    }

    return {
      status,
      rolling30,
      rolling100
    };
  }
}
