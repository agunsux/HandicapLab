export interface NotificationPayload {
  title: string;
  body: string;
  metadata?: any;
}

export class NotificationService {
  /**
   * Dispatches a personalized signal alert.
   * Logs notification actions to console for audit trail.
   */
  static async sendSignalAlert(
    userId: string,
    signalId: string,
    eventType: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    console.log(`[NotificationService] Sending Signal Alert to User ${userId}:`);
    console.log(`  Signal ID:  ${signalId}`);
    console.log(`  Event Type: ${eventType}`);
    console.log(`  Title:      ${payload.title}`);
    console.log(`  Body:       ${payload.body}`);
    return true;
  }

  /**
   * Dispatches a daily signals digest summary.
   */
  static async sendDigest(
    userId: string,
    payload: { tier: 'FREE' | 'PREMIUM'; signalsCount: number; htmlContent: string }
  ): Promise<boolean> {
    console.log(`[NotificationService] Sending Daily Digest to User ${userId} (${payload.tier}):`);
    console.log(`  Signals Count: ${payload.signalsCount}`);
    console.log(`  Content preview: ${payload.htmlContent.substring(0, 100)}...`);
    return true;
  }
}
