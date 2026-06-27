import { PaymentProvider } from '../core/paymentProvider';
import { NormalizedPaymentEvent } from '../core/types';
import { verifyStripeSignature } from './verifyWebhook';

export class StripePaymentProvider implements PaymentProvider {
  name = 'stripe' as const;

  async verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<boolean> {
    const signatureHeader = headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET || 'mock_secret';
    return verifyStripeSignature(rawBody, signatureHeader, secret);
  }

  async parseEvent(rawBody: string, headers: Record<string, string>): Promise<NormalizedPaymentEvent> {
    const payload = JSON.parse(rawBody);
    const eventId = payload.id;
    const eventType = payload.type;
    const sessionObj = payload.data?.object || {};

    const transactionId = sessionObj.metadata?.transaction_id || '';
    const productId = sessionObj.metadata?.product_id || '';
    const userId = sessionObj.metadata?.user_id || '';
    const amount = sessionObj.amount_total ? sessionObj.amount_total / 100 : (sessionObj.amount || 0);
    const currency = (sessionObj.currency || 'usd').toUpperCase();

    let normalizedEvent: NormalizedPaymentEvent['event'] = 'payment.success';
    if (eventType === 'checkout.session.completed') {
      normalizedEvent = 'payment.success';
    } else if (eventType === 'charge.failed' || eventType === 'payment_intent.payment_failed') {
      normalizedEvent = 'payment.failed';
    } else if (eventType === 'charge.refunded') {
      normalizedEvent = 'charge.refunded';
    } else if (eventType === 'customer.subscription.deleted') {
      normalizedEvent = 'subscription.deleted';
    }

    return {
      provider: 'stripe',
      event: normalizedEvent,
      transaction_id: transactionId,
      provider_transaction_id: sessionObj.id || '',
      product_id: productId,
      user_id: userId,
      amount: amount,
      currency: currency,
      payload: payload,
      event_id: eventId
    };
  }
}
