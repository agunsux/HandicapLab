import Link from 'next/link';

export default function PricingPage() {
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
          <Link href="/dashboard" className="text-xs font-mono text-slate-400 hover:text-white transition-colors">
            App Dashboard
          </Link>
        </div>
      </header>

      {/* Pricing Cards Body */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-16 space-y-16">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">Flexible Probability Intelligence Tiers</h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Choose between standard monthly plans, lifetime access, or flexible one-time credit packages depending on your analytical volume.
          </p>
        </div>

        {/* Core Subscription Tiers */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Free Tier */}
          <div className="bg-slate-900/40 border border-slate-900 p-8 rounded-xl flex flex-col justify-between space-y-8 hover:border-slate-800 transition-colors">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Standard Tier</span>
                <h3 className="text-xl font-bold text-white mt-1">Free Sandbox</h3>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Perfect for getting started with HandicapLab tools and understanding the model interface parameters.
              </p>
              <div className="text-3xl font-extrabold text-white">$0 <span className="text-xs text-slate-500 font-normal">/ forever</span></div>
              <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-slate-900">
                <li className="flex items-center gap-2">✔ 10 Daily credits</li>
                <li className="flex items-center gap-2">✔ Standard market scanner filters</li>
                <li className="flex items-center gap-2">✔ Historical backtesting summary</li>
                <li className="text-slate-500">✘ Real-time API query webhooks</li>
              </ul>
            </div>
            <Link href="/dashboard">
              <button className="w-full py-2.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-white font-semibold text-xs transition-colors">
                Start Analyzing
              </button>
            </Link>
          </div>

          {/* Premium Monthly (Recommended) */}
          <div className="bg-slate-900 border border-emerald-500/20 p-8 rounded-xl flex flex-col justify-between space-y-8 relative hover:border-emerald-500/40 transition-colors">
            <div className="absolute top-0 right-6 -translate-y-1/2">
              <span className="bg-emerald-500 text-slate-950 font-bold font-mono text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">Recommended</span>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">Unlimited Analytics</span>
                <h3 className="text-xl font-bold text-white mt-1">Premium Pass</h3>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                For active analysts and systems needing full access to every fixture with zero usage boundaries.
              </p>
              <div className="text-3xl font-extrabold text-white">$29 <span className="text-xs text-slate-500 font-normal">/ month</span></div>
              <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-slate-800">
                <li className="flex items-center gap-2 text-emerald-400">✔ Unlimited matches analyzed</li>
                <li className="flex items-center gap-2">✔ Priority model processing</li>
                <li className="flex items-center gap-2">✔ Complete historical backtest log CSVs</li>
                <li className="flex items-center gap-2">✔ Next-day fixture alerts email/webhook</li>
              </ul>
            </div>
            <Link href="/dashboard">
              <button className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors">
                Upgrade Now
              </button>
            </Link>
          </div>

          {/* Lifetime Access */}
          <div className="bg-slate-900/40 border border-slate-900 p-8 rounded-xl flex flex-col justify-between space-y-8 hover:border-slate-800 transition-colors">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Perpetual Tier</span>
                <h3 className="text-xl font-bold text-white mt-1">Lifetime License</h3>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Pay once. Gain full access to all future model updates and version improvements with no recurring bills.
              </p>
              <div className="text-3xl font-extrabold text-white">$199 <span className="text-xs text-slate-500 font-normal">/ one-time</span></div>
              <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-slate-900">
                <li className="flex items-center gap-2">✔ Perpetual premium features</li>
                <li className="flex items-center gap-2">✔ Personal developer API token</li>
                <li className="flex items-center gap-2">✔ Discord community private access</li>
                <li className="flex items-center gap-2">✔ Dedicated support channel</li>
              </ul>
            </div>
            <Link href="/dashboard">
              <button className="w-full py-2.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-white font-semibold text-xs transition-colors">
                Get Lifetime License
              </button>
            </Link>
          </div>
        </section>

        {/* Credit Packages (Pay-as-you-go) */}
        <section className="space-y-6 pt-8 border-t border-slate-900">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-xl font-bold text-white">Need occasional data? Purchase credits.</h2>
            <p className="text-slate-400 text-xs">
              Credits allow you to trigger Poisson updates on individual fixtures. Credits do not expire.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Starter pack */}
            <div className="bg-slate-900/30 border border-slate-900 p-6 rounded-lg flex items-center justify-between gap-4 hover:border-slate-800 transition-colors">
              <div className="space-y-1">
                <h4 className="font-bold text-white">Starter Package</h4>
                <p className="text-slate-400 text-xs">50 analysis credits for individual match runs.</p>
                <div className="text-slate-300 font-mono text-sm font-semibold pt-1">$9.00 one-time</div>
              </div>
              <Link href="/dashboard">
                <button className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors">
                  Buy Package
                </button>
              </Link>
            </div>

            {/* Pro Pack */}
            <div className="bg-slate-900/30 border border-slate-900 p-6 rounded-lg flex items-center justify-between gap-4 hover:border-slate-800 transition-colors">
              <div className="space-y-1">
                <h4 className="font-bold text-white">Pro Package</h4>
                <p className="text-slate-400 text-xs">300 analysis credits (equivalent to $0.06 per check).</p>
                <div className="text-slate-300 font-mono text-sm font-semibold pt-1">$19.00 one-time</div>
              </div>
              <Link href="/dashboard">
                <button className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors">
                  Buy Package
                </button>
              </Link>
            </div>
          </div>
        </section>
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
            <Link href="/dashboard" className="hover:text-slate-350">App Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
