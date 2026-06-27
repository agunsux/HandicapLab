'use client';

import React, { useState, useEffect } from 'react';
import { checkUserEntitlementsAction } from '@/app/actions/monetization';
import { PPP_TIERS } from '@/lib/monetization/gating';

interface UpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UpsellModal({ isOpen, onClose, onSuccess }: UpsellModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pppTier, setPppTier] = useState<string>('TIER_1');
  const [slotsAvailable, setSlotsAvailable] = useState<boolean>(true);
  const [founderCount, setFounderCount] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      loadDetails();
    }
  }, [isOpen]);

  async function loadDetails() {
    setLoading(true);
    const data = await checkUserEntitlementsAction();
    setIsAuthenticated(data.isAuthenticated);
    setPppTier(data.pppTier);
    setSlotsAvailable(data.founderSlotsAvailable);
    setFounderCount(data.founderCount);
    setLoading(false);
  }

  async function handlePurchase(productType: 'LIFETIME' | 'CREDITS') {
    setPurchasing(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_type: productType, ppp_tier: pppTier })
      });

      const resData = await response.json();
      if (resData.url) {
        // Mock gateway redirect
        window.location.href = resData.url;
      } else {
        alert('Checkout initialization failed.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Error connecting to checkout gateway.');
    } finally {
      setPurchasing(false);
    }
  }

  if (!isOpen) return null;

  const tierConfig = PPP_TIERS[pppTier] || PPP_TIERS.TIER_1;
  const lifetimePriceDisplay = slotsAvailable ? tierConfig.founderPrice : tierConfig.lifetimePrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#070D19]/90 border border-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col space-y-6 text-[#E2E8F0] font-sans">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 font-mono text-sm focus:outline-none"
        >
          ✕ CLOSE
        </button>

        {/* Heading */}
        <div className="space-y-1.5 border-b border-slate-850 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <h2 className="text-lg font-mono font-bold tracking-tight text-white uppercase">
              QUANT UNLOCK SUITE
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Elevate your market modeling with direct Dixon-Coles parameters, Poisson forecast math, and ELO shift ratings.
          </p>
        </div>

        {/* Founder Slot Alert */}
        {slotsAvailable ? (
          <div className="bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 rounded-xl text-xs font-mono text-emerald-400 flex items-center justify-between">
            <span>🔥 <b>FOUNDER OFFER:</b> slots active!</span>
            <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-white font-bold">
              {founderCount} / 500 SLOTS TAKEN
            </span>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>🔒 Founder slots are fully filled. Normal PPP pricing active.</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <span className="w-6 h-6 rounded-full border-2 border-t-teal-400 border-slate-800 animate-spin"></span>
            <span className="ml-3 text-xs text-slate-400 font-mono">Fetching PPP localized prices...</span>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Option 1: Lifetime Pro */}
            <div className="bg-slate-900/60 border border-slate-800 hover:border-teal-500/40 p-5 rounded-xl transition-all flex flex-col justify-between gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-mono font-bold text-white uppercase">Lifetime Quant Pro</span>
                  <span className="text-lg font-mono font-bold text-teal-400">{lifetimePriceDisplay} USD</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Unlimited, lifetime access to all ensembled pre-match forecasting models. One-time payment. Never pay monthly fees. Includes future updates and World Cup metrics.
                </p>
              </div>
              <button
                disabled={purchasing}
                onClick={() => handlePurchase('LIFETIME')}
                className="w-full bg-teal-500 hover:bg-teal-400 disabled:bg-slate-800 text-slate-950 font-mono font-bold text-xs py-2.5 rounded-lg transition-all uppercase tracking-wider shadow"
              >
                {purchasing ? 'INITIALIZING CHECKOUT...' : 'Get Lifetime Pro'}
              </button>
            </div>

            {/* Option 2: Credit Pack */}
            <div className="bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 p-5 rounded-xl transition-all flex flex-col justify-between gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-mono font-bold text-white uppercase">10 Forensics Credits</span>
                  <span className="text-lg font-mono font-bold text-emerald-400">{tierConfig.creditsPrice} USD</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Unlock forensic popovers on-demand. 1 credit unlocks full Dixon-Coles and Poisson rating vectors for one fixture. Buy more whenever you need them.
                </p>
              </div>
              <button
                disabled={purchasing}
                onClick={() => handlePurchase('CREDITS')}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-mono font-bold text-xs py-2.5 rounded-lg transition-all uppercase tracking-wider shadow"
              >
                {purchasing ? 'INITIALIZING CHECKOUT...' : 'Buy 10 Credits'}
              </button>
            </div>

          </div>
        )}

        {/* Footer Disclaimer */}
        <div className="text-[10px] font-mono text-slate-500 text-center uppercase tracking-wide leading-relaxed border-t border-slate-850 pt-4">
          PPP Tier Detected: {tierConfig.tierName} • Prices adjusted based on country index.
        </div>
      </div>
    </div>
  );
}
