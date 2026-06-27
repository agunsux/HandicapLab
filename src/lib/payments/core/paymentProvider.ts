import { NormalizedPaymentEvent } from './types';

export interface PaymentProvider {
  name: 'stripe' | 'midtrans';
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<boolean>;
  parseEvent(rawBody: string, headers: Record<string, string>): Promise<NormalizedPaymentEvent>;
}
