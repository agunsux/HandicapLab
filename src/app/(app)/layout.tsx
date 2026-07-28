import Link from 'next/link';
import { UserSessionPanel } from '@/components/UserSessionPanel';

const navItems = [
  { href: '/picks', label: 'Picks', icon: '🏆', desc: 'Best betting opportunities' },
  { href: '/matches', label: 'Matches', icon: '⚽', desc: 'All fixtures & markets' },
  { href: '/results', label: 'Results', icon: '📊', desc: 'Settled predictions' },
  { href: '/account', label: 'Account', icon: '👤', desc: 'Settings & research tools' },
];

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-lg tracking-wider">
            H
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-white leading-none">Handicap<span className="text-emerald-400">Lab</span></span>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-widest">Verified Predictions</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <span className="text-lg">{item.icon}</span>
              <div className="flex flex-col">
                <span className="text-white font-semibold">{item.label}</span>
                <span className="text-[10px] text-slate-500 font-mono">{item.desc}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="px-4 pb-4 border-t border-slate-800 pt-4">
          <Link
            href="/research-lab"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          >
            <span className="text-base">🔬</span>
            <span>Research Lab</span>
          </Link>
        </div>

        <UserSessionPanel />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="flex items-center gap-6 overflow-x-auto py-1 scrollbar-none font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-500 uppercase">Track Record:</span>
              <span className="text-emerald-400 font-bold">+12.4% ROI</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <span className="text-slate-500 uppercase">Verified Bets:</span>
              <span className="text-slate-300 font-bold">182,431</span>
            </div>
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-slate-500 uppercase">CLV:</span>
              <span className="text-emerald-400 font-bold">+2.7%</span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-slate-500 uppercase">Value Fixtures Today:</span>
              <span className="text-amber-400 font-bold">2 Matches</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-400">
              <span className="text-white font-semibold">Verified ✓</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}