import { supabase } from '@/lib/supabase.server';

export class PerformanceAttribution {
  public static getConfidenceBucket(confidence: number): string {
    // Handle both 0-1 and 0-100 scales
    const conf = confidence <= 1.0 ? confidence * 100 : confidence;
    if (conf >= 90) return '90+';
    if (conf >= 80) return '80-90';
    if (conf >= 70) return '70-80';
    return '60-70';
  }

  public static getOddsRange(odds: number): string {
    if (odds < 1.70) return '<1.70';
    if (odds <= 2.00) return '1.70-2.00';
    return '>2.00';
  }

  public static async logAttribution(signal: any, status: string, profitLoss: number, clv: number) {
    const isWin = status === 'won';
    const isLoss = status === 'lost';
    
    const confidence = Number(signal.confidence || 0.75);
    const odds = Number(signal.odds || 1.95);
    
    const confidenceBucket = this.getConfidenceBucket(confidence);
    const oddsRange = this.getOddsRange(odds);
    const marketType = signal.market_category || signal.market || 'moneyline';
    const competition = signal.league || 'Unknown';
    const bookmaker = 'pinnacle';

    // Calculate flat unit ROI
    let roi = 0;
    if (isWin) {
      roi = (odds - 1.0) * 100;
    } else if (isLoss) {
      roi = -100.0;
    }

    await supabase
      .from('signal_performance_attribution')
      .insert({
        signal_id: signal.id,
        competition,
        market_type: marketType,
        confidence_bucket: confidenceBucket,
        odds_range: oddsRange,
        bookmaker,
        is_win: isWin,
        is_loss: isLoss,
        roi,
        clv: clv * 100, // CLV as percentage
        edge: Number(signal.edge_pct || 0.0)
      });
  }
}
