export interface CheckoutSessionOptions {
  userId: string;
  tier: 'PRO' | 'ELITE' | 'LIFETIME';
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
}

export interface SubscriptionStatus {
  status: 'active' | 'cancelled' | 'expired';
  expiresAt: Date | null;
}

export interface BillingAdapter {
  createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatus>;
}

export class StripeBillingAdapter implements BillingAdapter {
  public async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    console.log(`[Stripe] Creating checkout session for user ${options.userId}, tier ${options.tier}`);
    return {
      sessionId: `stripe_mock_sess_${Math.random().toString(36).substring(2, 11)}`,
      checkoutUrl: `https://checkout.stripe.com/pay/mock_${options.tier.toLowerCase()}`
    };
  }

  public async cancelSubscription(subscriptionId: string): Promise<void> {
    console.log(`[Stripe] Cancelling subscription ${subscriptionId}`);
  }

  public async getSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatus> {
    console.log(`[Stripe] Querying status for subscription ${subscriptionId}`);
    return {
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }
}

export class LemonSqueezyBillingAdapter implements BillingAdapter {
  public async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    console.log(`[LemonSqueezy] Creating checkout session for user ${options.userId}, tier ${options.tier}`);
    return {
      sessionId: `ls_mock_sess_${Math.random().toString(36).substring(2, 11)}`,
      checkoutUrl: `https://handicaplab.lemonsqueezy.com/checkout/mock_${options.tier.toLowerCase()}`
    };
  }

  public async cancelSubscription(subscriptionId: string): Promise<void> {
    console.log(`[LemonSqueezy] Cancelling subscription ${subscriptionId}`);
  }

  public async getSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatus> {
    console.log(`[LemonSqueezy] Querying status for subscription ${subscriptionId}`);
    return {
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }
}

export class CryptoBillingAdapter implements BillingAdapter {
  public async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    console.log(`[Crypto] Generating deposit address for user ${options.userId}, tier ${options.tier}`);
    return {
      sessionId: `crypto_mock_payment_${Math.random().toString(36).substring(2, 11)}`,
      checkoutUrl: `https://handicaplab.io/payment/crypto/mock_${options.tier.toLowerCase()}`
    };
  }

  public async cancelSubscription(subscriptionId: string): Promise<void> {
    console.log(`[Crypto] Expiring deposit address/subscription ${subscriptionId}`);
  }

  public async getSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatus> {
    return {
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }
}

export class RegionalBillingAdapter implements BillingAdapter {
  public async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    console.log(`[RegionalBilling] Creating regional pricing checkout session for user ${options.userId}, tier ${options.tier}`);
    return {
      sessionId: `regional_mock_sess_${Math.random().toString(36).substring(2, 11)}`,
      checkoutUrl: `https://handicaplab.com/billing/regional/mock_${options.tier.toLowerCase()}`
    };
  }

  public async cancelSubscription(subscriptionId: string): Promise<void> {
    console.log(`[RegionalBilling] Cancelling regional subscription ${subscriptionId}`);
  }

  public async getSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatus> {
    return {
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }
}
