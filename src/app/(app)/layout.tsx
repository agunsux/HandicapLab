import Link from 'next/link';

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Bloomberg-style Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-lg tracking-wider">
            H
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-white leading-none">Handicap<span className="text-emerald-400">Lab</span></span>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-widest">Market Intelligence</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-2 mb-2">Analytics</div>
          
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-slate-800/50 text-emerald-400 border border-emerald-500/20 hover:bg-slate-800 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layout-dashboard"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="10" rx="1"/><rect width="7" height="5" x="3" y="14" rx="1"/></svg>
            <span>Today's Value</span>
          </Link>
          
          <Link
            href="/scanner"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-400 hover:bg-slate-850 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-radar"><path d="M19.07 4.93a10 10 0 0 0-14.14 0M16.24 7.76a6 6 0 0 0-8.49 0"/><circle cx="12" cy="12" r="2"/><path d="M12 2v10"/></svg>
            <span>Match Scanner</span>
          </Link>

          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-2 pt-6 mb-2">Verification</div>
          
          <Link
            href="/dashboard#backtest"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-400 hover:bg-slate-850 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trending-up"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            <span>Model Backtesting</span>
          </Link>

          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-2 pt-6 mb-2">Account</div>
          
          <Link
            href="/pricing"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-400 hover:bg-slate-850 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-credit-card"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            <span>Premium Plans</span>
          </Link>
        </nav>

        {/* Bottom Panel */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Free Plan</span>
            <span className="font-mono text-emerald-400 font-semibold">10 Credits</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mb-4">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '40%' }}></div>
          </div>
          <Link href="/pricing">
            <button className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs tracking-tight transition-colors">
              Upgrade to Premium
            </button>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Ticker / Top Bar */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 z-10 shrink-0">
          {/* Ticker Info */}
          <div className="flex items-center gap-6 overflow-x-auto py-1 scrollbar-none font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-500 uppercase">Live Engine:</span>
              <span className="text-slate-300">Poisson v1.2</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <span className="text-slate-500 uppercase">Model ROI:</span>
              <span className="text-emerald-400 font-bold">+14.7%</span>
            </div>
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-slate-500 uppercase">Win Rate:</span>
              <span className="text-slate-300 font-bold">60.1%</span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-slate-500 uppercase">Value Fixtures Today:</span>
              <span className="text-amber-400 font-bold">2 Matches</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-400">
              Logged in as <span className="text-white font-semibold">demo@handicaplab.com</span>
            </div>
          </div>
        </header>

        {/* Viewport content */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
