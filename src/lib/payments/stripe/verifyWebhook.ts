import crypto from 'crypto';

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  endpointSecret: string | undefined
): boolean {
  if (!signatureHeader || !endpointSecret || !rawBody) {
    console.error('[Stripe Webhook] Missing signature, secret, or body payload');
    return false;
  }

  try {
    const parts = signatureHeader.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      if (key && value) {
        acc[key.trim()] = value.trim();
      }
      return acc;
    }, {} as Record<string, string>);

    const timestamp = parts['t'];
    const receivedSignature = parts['v1'];

    if (!timestamp || !receivedSignature) {
      console.error('[Stripe Webhook] Missing t or v1 in signature header');
      return false;
    }

    // Protect against replay attacks (e.g. 5 minutes maximum drift)
    const age = Math.floor(Date.now() / 1000) - Number(timestamp);
    if (Math.abs(age) > 300) {
      console.warn(`[Stripe Webhook] Timestamp drift too high (${age}s)`);
      return false;
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', endpointSecret)
      .update(signedPayload)
      .digest('hex');

    if (expectedSignature.length !== receivedSignature.length) {
      return false;
    }

    // Use timing-safe comparisons to block side-channel attacks
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (err) {
    console.error('[Stripe Webhook Verification Error]:', err);
    return false;
  }
}
