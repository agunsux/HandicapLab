import { supabase } from '../../supabase.server';
import { PaymentProvider } from '../core/paymentProvider';
import { NormalizedPaymentEvent } from '../core/types';
import { verifyMidtransSignature } from './verifyWebhook';

export class MidtransPaymentProvider implements PaymentProvider {
  name = 'midtrans' as const;

  async verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<boolean> {
    const payload = JSON.parse(rawBody);
    const signatureKey = payload.signature_key;
    const orderId = payload.order_id;
    const statusCode = payload.status_code;
    const grossAmount = payload.gross_amount;
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'mock_server_key';

    return verifyMidtransSignature(orderId, statusCode, grossAmount, serverKey, signatureKey);
  }

  async parseEvent(rawBody: string, headers: Record<string, string>): Promise<NormalizedPaymentEvent> {
    const payload = JSON.parse(rawBody);
    const orderId = payload.order_id;
    const transactionStatus = payload.transaction_status;
    const grossAmount = payload.gross_amount;

    let userId = payload.custom_field1 || '';
    let productId = payload.custom_field2 || '';

    // If metadata not sent by gateway, look up the pre-logged transaction in DB
    if ((!userId || !productId) && orderId) {
      try {
        const { data: tx } = await supabase
          .from('transactions')
          .select('user_id, product_id')
          .eq('id', orderId)
          .maybeSingle();

        if (tx) {
          userId = userId || tx.user_id || '';
          productId = productId || tx.product_id || '';
        }
      } catch (err) {
        console.error('[Midtrans Parse] Failed to look up transaction:', err);
      }
    }

    let normalizedEvent: NormalizedPaymentEvent['event'] = 'payment.success';
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      normalizedEvent = 'payment.success';
    } else if (
      transactionStatus === 'deny' ||
      transactionStatus === 'expire' ||
      transactionStatus === 'cancel'
    ) {
      normalizedEvent = 'payment.failed';
    } else if (transactionStatus === 'refund') {
      normalizedEvent = 'charge.refunded';
    }

    return {
      provider: 'midtrans',
      event: normalizedEvent,
      transaction_id: orderId,
      provider_transaction_id: payload.transaction_id || '',
      product_id: productId,
      user_id: userId,
      amount: Number(grossAmount),
      currency: 'IDR',
      payload: payload,
      event_id: payload.transaction_id || orderId
    };
  }
}
