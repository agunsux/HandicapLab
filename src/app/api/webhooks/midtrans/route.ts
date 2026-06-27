import { NextResponse } from 'next/server';
import { MidtransPaymentProvider } from '@/lib/payments/midtrans/handler';
import { paymentEventProcessor } from '@/lib/payments/core/paymentEvent';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const headersList = Object.fromEntries(req.headers.entries());

    const provider = new MidtransPaymentProvider();

    // 1. Verify signature
    const isValid = await provider.verifyWebhook(rawBody, headersList);
    if (!isValid) {
      console.warn('[Midtrans Webhook] Invalid signature key detected');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    // 2. Parse event
    const normalizedEvent = await provider.parseEvent(rawBody, headersList);

    // 3. Process event
    const result = await paymentEventProcessor(normalizedEvent);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[Midtrans Webhook Endpoint Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
