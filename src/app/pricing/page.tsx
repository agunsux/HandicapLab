'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const router = useRouter();
  const [activeTier, setActiveTier] = useState<string>('FREE');
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    const savedTier = localStorage.getItem('handicaplab_user_tier') || 'FREE';
    setActiveTier(savedTier);

    // Track pricing page view
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'pricing_view', metadata: { source: 'pricing_page' } })
    }).catch(err => console.error(err));
  }, []);

  const handleSelectTier = (tierKey: string, tierName: string) => {
    setPurchasing(tierName);

    // Track upgrade click event
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'upgrade_clicked', metadata: { tier: tierKey } })
    }).catch(err => console.error(err));

    localStorage.setItem('handicaplab_user_tier', tierKey);
    window.dispatchEvent(new Event('handicaplab_tier_changed'));
    
    setTimeout(() => {
      setPurchasing(null);
      router.push('/scanner');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between selection:bg-emerald-500/20 selection:text-emerald-400">
      {/* Navigation Header */}
      <header className="max-w-7xl mx-auto w-full px-6 h-20 flex items-center justify-between border-b border-slate-900">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-lg tracking-wider">
              H
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-white leading-none text-base">Handicap<span className="text-emerald-400">Lab</span></span>
              <span className="text-[9px] text-slate-500 font-mono mt-0.5 uppercase tracking-widest">Market Intelligence</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/scanner" className="text-xs font-mono text-slate-400 hover:text-white transition-colors">
            Edge Scanner Terminal
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-16 space-y-16">
        {/* Success Overlay */}
        {purchasing && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
            <div className="bg-slate-900 border border-emerald-500/30 p-8 rounded-2xl text-center max-w-sm space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3 className="text-xl font-bold text-white">Tier Activated!</h3>
              <p className="text-slate-400 text-xs leading-normal">
                Simulating subscription change for <strong>{purchasing}</strong>. Redirecting to your football intelligence terminal...
              </p>
            </div>
          </div>
        )}

        <div className="text-center max-w-2xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">Flexible Intelligence Tiers</h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Gain the quantitative edge. Select your subscription tier to access Dixon-Coles probabilities, CLV tracking, and Asian Handicap analysis.
          </p>
        </div>

        {/* 4 Plans Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {/* Free Card */}
          <div className={`bg-slate-900/40 border p-6 rounded-xl flex flex-col justify-between space-y-6 hover:border-slate-800 transition-colors ${activeTier === 'FREE' ? 'border-emerald-500/20' : 'border-slate-900'}`}>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Free Tier</span>
                <h3 className="text-lg font-bold text-white mt-1">Free Sandbox</h3>
              </div>
              <p className="text-slate-450 text-xs leading-relaxed">
                Test the model interface and basic predictions list with basic capabilities.
              </p>
              <div className="text-2xl font-extrabold text-white">$0 <span className="text-xs text-slate-500 font-normal">/ forever</span></div>
              <ul className="text-xs text-slate-400 space-y-2 pt-4 border-t border-slate-900 font-mono">
                <li className="flex items-center gap-1.5 text-slate-350">✔ 3 daily reveals</li>
                <li className="flex items-center gap-1.5 text-slate-350">✔ Limited scanner feed</li>
                <li className="flex items-center gap-1.5 text-amber-500">⚠ Basic match details</li>
                <li className="flex items-center gap-1.5 text-slate-500">✘ No CLV expectation</li>
                <li className="flex items-center gap-1.5 text-slate-500">✘ No Kelly stakes</li>
              </ul>
            </div>
            <button
              onClick={() => handleSelectTier('FREE', 'Free Sandbox')}
              className={`w-full py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTier === 'FREE'
                  ? 'bg-slate-850 text-emerald-400 border border-emerald-500/20 cursor-default'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {activeTier === 'FREE' ? 'Active Plan' : 'Select Free'}
            </button>
          </div>

          {/* Pro Card */}
          <div className={`bg-slate-900 border p-6 rounded-xl flex flex-col justify-between space-y-6 relative hover:border-emerald-500/40 transition-colors ${activeTier === 'PRO' ? 'border-emerald-500/50' : 'border-emerald-500/20'}`}>
            <div className="absolute top-0 right-6 -translate-y-1/2">
              <span className="bg-emerald-500 text-slate-950 font-bold font-mono text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">Most Popular</span>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Professional</span>
                <h3 className="text-lg font-bold text-white mt-1">Pro</h3>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Full quantitative suite for identifying and trading statistical market edges.
              </p>
              <div className="text-2xl font-extrabold text-white">$29 <span className="text-xs text-slate-500 font-normal">/ month</span></div>
              <ul className="text-xs text-slate-350 space-y-2 pt-4 border-t border-slate-800 font-mono">
                <li className="flex items-center gap-1.5 text-emerald-400">✔ Full Edge Scanner</li>
                <li className="flex items-center gap-1.5">✔ Real-time odds feed</li>
                <li className="flex items-center gap-1.5">✔ Expected Value (EV) %</li>
                <li className="flex items-center gap-1.5">✔ Closing Line Value (CLV)</li>
                <li className="flex items-center gap-1.5">✔ Paper trade ledger</li>
              </ul>
            </div>
            <button
              onClick={() => handleSelectTier('PRO', 'Pro Membership')}
              className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                activeTier === 'PRO'
                  ? 'bg-slate-850 text-emerald-400 border border-emerald-500/20 cursor-default'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              {activeTier === 'PRO' ? 'Active Plan' : 'Select Pro'}
            </button>
          </div>

          {/* Quant Card */}
          <div className={`bg-slate-900/40 border p-6 rounded-xl flex flex-col justify-between space-y-6 hover:border-slate-800 transition-colors ${activeTier === 'QUANT' ? 'border-emerald-500/30' : 'border-slate-900'}`}>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Syndicates</span>
                <h3 className="text-lg font-bold text-white mt-1">Quant</h3>
              </div>
              <p className="text-slate-450 text-xs leading-relaxed">
                Programmatic API integration, webhooks, and raw data downloads.
              </p>
              <div className="text-2xl font-extrabold text-white">$99 <span className="text-xs text-slate-500 font-normal">/ month</span></div>
              <ul className="text-xs text-slate-400 space-y-2 pt-4 border-t border-slate-900 font-mono">
                <li className="flex items-center gap-1.5 text-slate-350">✔ Rest API access</li>
                <li className="flex items-center gap-1.5 text-slate-350">✔ Real-time webhooks</li>
                <li className="flex items-center gap-1.5 text-slate-350">✔ Custom EV filter webhooks</li>
                <li className="flex items-center gap-1.5 text-slate-350">✔ Excel/CSV data exports</li>
                <li className="flex items-center gap-1.5 text-emerald-400">✔ Premium Discord access</li>
              </ul>
            </div>
            <button
              onClick={() => handleSelectTier('QUANT', 'Quant Membership')}
              className={`w-full py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTier === 'QUANT'
                  ? 'bg-slate-850 text-emerald-400 border border-emerald-500/20 cursor-default'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {activeTier === 'QUANT' ? 'Active Plan' : 'Select Quant'}
            </button>
          </div>

          {/* Founder Lifetime Card */}
          <div className={`bg-slate-900/40 border p-6 rounded-xl flex flex-col justify-between space-y-6 hover:border-slate-800 transition-colors ${activeTier === 'FOUNDER' ? 'border-emerald-500/30' : 'border-slate-900'}`}>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Founding Member</span>
                <h3 className="text-lg font-bold text-white mt-1">Founder Lifetime</h3>
              </div>
              <p className="text-slate-450 text-xs leading-relaxed">
                Pay once. Lifetime access to current plan features with zero future subscription bills.
              </p>
              <div className="text-2xl font-extrabold text-white">$199 <span className="text-xs text-slate-500 font-normal">/ one-time</span></div>
              <ul className="text-xs text-slate-400 space-y-2 pt-4 border-t border-slate-900 font-mono">
                <li className="flex items-center gap-1.5 text-emerald-400">✔ Limited lifetime access</li>
                <li className="flex items-center gap-1.5 text-slate-350">✔ Perpetual Pro scanner</li>
                <li className="flex items-center gap-1.5 text-slate-350">✔ Price locked forever</li>
                <li className="flex items-center gap-1.5 text-slate-350">✔ No monthly bills ever</li>
              </ul>
            </div>
            <button
              onClick={() => handleSelectTier('FOUNDER', 'Founder Lifetime License')}
              className={`w-full py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTier === 'FOUNDER'
                  ? 'bg-slate-850 text-emerald-400 border border-emerald-500/20 cursor-default'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {activeTier === 'FOUNDER' ? 'Active Plan' : 'Select Founder'}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-left space-y-2 max-w-xl">
            <div className="text-xs text-slate-500 font-mono">
              © {new Date().getFullYear()} HandicapLab. All rights reserved.
            </div>
            <p className="text-[10px] text-slate-600 leading-normal">
              <strong>Risk Warning:</strong> HandicapLab is a decision-support market analytics platform. We do not provide financial advice or guarantee profits. Football matches involve statistical variance. Users are responsible for their analytical decisions. This is not a gambling platform.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
            <Link href="/" className="hover:text-slate-350">Home</Link>
            <span>•</span>
            <Link href="/scanner" className="hover:text-slate-350">Edge Scanner Terminal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
