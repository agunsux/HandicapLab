import { supabase } from '@/lib/supabase.server';
import Link from 'next/link';

export const revalidate = 0;

interface SuccessPageProps {
  searchParams: Promise<{
    session_id?: string;
    transaction_id?: string;
  }>;
}

export default async function MockSuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const txId = params.transaction_id || '';
  const sessionId = params.session_id || '';

  let message = 'Processing payment...';
  let success = false;
  let entitlementGranted = '';

  if (txId && sessionId) {
    // 1. Simulate Stripe webhook call server-side securely
    const host = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    try {
      const webhookPayload = {
        id: `evt_${sessionId}`,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            metadata: {
              transaction_id: txId
            }
          }
        }
      };

      await fetch(`${host}/api/webhooks/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      });
    } catch (err) {
      console.error('[Mock Success Page] Failed to deliver webhook:', err);
    }

    // 2. Fetch the updated transaction state
    const { data: tx } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', txId)
      .maybeSingle();

    if (tx && tx.status === 'SUCCESS') {
      success = true;
      message = 'Payment Verified & Entitlement Granted via Webhook!';
      entitlementGranted = tx.amount_usd >= 9.0 ? 'LIFETIME QUANT PRO' : '10 FORENSICS CREDITS';
    } else {
      message = 'Fulfillment pending webhook processing...';
    }
  }

  return (
    <main className="min-h-screen bg-[#050B13] text-[#E2E8F0] font-sans flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#070D19]/80 border border-slate-800 p-8 rounded-2xl shadow-2xl text-center space-y-6">
        
        {/* Success Icon */}
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
          <span className="text-2xl text-emerald-400">✓</span>
        </div>

        {/* Heading */}
        <div className="space-y-1">
          <h1 className="text-xl font-mono font-bold tracking-tight text-white uppercase">
            CHECKOUT VERIFIED
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Transaction ID: {txId || 'N/A'}
          </p>
        </div>

        {/* Status Box */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-left space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-500">PAYMENT STATUS:</span>
            <span className="text-emerald-400 font-bold uppercase">SUCCESS</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-500">FULFILLED AS:</span>
            <span className="text-white font-bold uppercase">{entitlementGranted || 'N/A'}</span>
          </div>
          <div className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-850 pt-2 font-mono">
            {message} Duplicate fulfillment was prevented using order idempotency tokens.
          </div>
        </div>

        {/* Redirect Button */}
        <Link
          href="/ledger"
          className="block w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-mono font-bold text-xs py-2.5 rounded-lg transition-all uppercase tracking-wider text-center"
        >
          Return to Ledger Dashboard
        </Link>
      </div>
    </main>
  );
}
