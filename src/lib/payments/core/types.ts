export type PaymentProviderName = 'stripe' | 'midtrans';

export type PaymentEventType =
  | 'payment.success'
  | 'payment.failed'
  | 'charge.refunded'
  | 'subscription.deleted';

export interface NormalizedPaymentEvent {
  provider: PaymentProviderName;
  event: PaymentEventType;
  transaction_id: string; // The internal transaction UUID
  provider_transaction_id: string; // The session/transaction ID from the provider
  product_id: string; // The internal product UUID
  user_id: string; // The user UUID
  amount: number; // Decimal numeric value
  currency: string;
  payload: any; // Raw provider payload for auditing
  event_id: string; // Unique provider event ID for idempotency
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  type: string;
  price: number; // integer (e.g. cents)
  currency: string;
  metadata: any;
  active: boolean;
  created_at: string;
}
