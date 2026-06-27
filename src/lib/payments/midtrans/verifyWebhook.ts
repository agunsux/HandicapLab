import crypto from 'crypto';

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  receivedSignature: string
): boolean {
  if (!orderId || !statusCode || !grossAmount || !serverKey || !receivedSignature) {
    console.error('[Midtrans Webhook] Missing parameter for signature verification');
    return false;
  }

  try {
    const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
    const computedSignature = crypto
      .createHash('sha512')
      .update(payload)
      .digest('hex');

    if (computedSignature.length !== receivedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(computedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (err) {
    console.error('[Midtrans Webhook Verification Error]:', err);
    return false;
  }
}
