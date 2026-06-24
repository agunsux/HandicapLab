'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function UserSessionPanel() {
  const [tier, setTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'QUANT' | 'LIFETIME'>('FREE');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTier = localStorage.getItem('handicaplab_user_tier') as any;
    if (savedTier && ['FREE', 'STARTER', 'PRO', 'QUANT', 'LIFETIME'].includes(savedTier)) {
      setTier(savedTier);
    }

    // Listen for tier changes from other pages
    const handleStorageChange = () => {
      const currentTier = localStorage.getItem('handicaplab_user_tier') as any;
      if (currentTier && ['FREE', 'STARTER', 'PRO', 'QUANT', 'LIFETIME'].includes(currentTier)) {
        setTier(currentTier);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('handicaplab_tier_changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('handicaplab_tier_changed', handleStorageChange);
    };
  }, []);

  const changeTier = (newTier: typeof tier) => {
    setTier(newTier);
    localStorage.setItem('handicaplab_user_tier', newTier);
    window.dispatchEvent(new Event('handicaplab_tier_changed'));
  };

  if (!mounted) {
    return (
      <div className="p-4 border-t border-slate-800 bg-slate-900/60 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-3/4 mb-2"></div>
        <div className="h-2 bg-slate-800 rounded w-full mb-4"></div>
        <div className="h-8 bg-slate-800 rounded w-full"></div>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-slate-800 bg-slate-900/60 space-y-4">
      <div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span className="font-mono uppercase tracking-wider text-[10px]">Simulation Mode</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 font-bold">
            {tier}
          </span>
        </div>
        <select
          value={tier}
          onChange={(e) => changeTier(e.target.value as any)}
          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        >
          <option value="FREE">Free Sandbox ($0)</option>
          <option value="STARTER">Starter ($9/mo)</option>
          <option value="PRO">Pro ($29/mo)</option>
          <option value="QUANT">Quant ($99/mo)</option>
          <option value="LIFETIME">Founder Lifetime ($199)</option>
        </select>
      </div>

      <div className="border-t border-slate-800/60 pt-3">
        {tier === 'FREE' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Free Plan Usage</span>
              <span className="font-mono text-emerald-400 font-semibold">5 / 10 matches</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '50%' }}></div>
            </div>
            <Link href="/pricing" className="block pt-1">
              <button className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-tight transition-colors">
                Upgrade to Pro
              </button>
            </Link>
          </div>
        )}

        {tier === 'STARTER' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Starter Plan Usage</span>
              <span className="font-mono text-emerald-400 font-semibold">Unlimited</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
            </div>
            <Link href="/pricing" className="block pt-1">
              <button className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs tracking-tight transition-colors border border-slate-750">
                Upgrade to Pro
              </button>
            </Link>
          </div>
        )}

        {tier !== 'FREE' && tier !== 'STARTER' && (
          <div className="space-y-2">
            <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Full Bloomberg Suite Active</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              You have unrestricted access to the Edge Scanner, live CLV tracking, backtest CSV logs, and advanced analytics.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
