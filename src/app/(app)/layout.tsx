import Link from 'next/link';
import { UserSessionPanel } from '@/components/UserSessionPanel';

const navItems = [
  { href: '/picks', label: 'PICKS', icon: 'F1', desc: 'Active signals' },
  { href: '/track-record', label: 'TRACK RECORD', icon: 'F2', desc: 'ROI & Brier metrics' },
  { href: '/ledger', label: 'LEDGER', icon: 'F3', desc: 'Public paper trades' },
  { href: '/methodology', label: 'METHODOLOGY', icon: 'F4', desc: 'Scientific model info' },
  { href: '/pricing', label: 'PRICING', icon: 'F5', desc: 'Subscription & passes' },
];

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background font-mono text-foreground">
      {/* Ticker Tape */}
      <div className="h-6 bg-primary text-primary-foreground flex items-center px-4 overflow-hidden text-[10px] font-bold tracking-widest whitespace-nowrap">
        <div className="animate-pulse flex gap-8">
           <span>CLV AVG: +2.4%</span>
           <span>BRIER: 0.21</span>
           <span>LATEST: ARS v CHE (LAYAK)</span>
           <span>SYS: OPERATIONAL</span>
        </div>
      </div>

      {/* Header / Command Bar */}
      <header className="h-14 bg-popover border-b border-border flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-6 h-6 bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">HL</div>
          <span className="font-bold tracking-tight text-foreground uppercase text-sm">HandicapLab<span className="text-primary ml-1">Terminal</span></span>
        </div>
        
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="px-3 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors rounded">
              <span className="text-primary mr-2">[{item.icon}]</span>{item.label}
            </Link>
          ))}
        </nav>
        
        <div className="flex items-center">
           <UserSessionPanel />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-background p-6">
        <div className="max-w-6xl mx-auto">
           {children}
        </div>
      </main>

      {/* Status Bar */}
      <footer className="h-8 bg-popover border-t border-border flex items-center justify-between px-4 text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">
        <div className="flex gap-4">
           <span>VER: 2.0.1</span>
           <span className="text-[var(--green-text)]">DATA: SYNCED</span>
        </div>
        <div>
           <span>© 2026 HANDICAPLAB</span>
        </div>
      </footer>
    </div>
  );
}