'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/app/value-bets', label: 'Value Bets' },
  { href: '/markets', label: 'Matches' },
  { href: '/research', label: 'Insights' },
];

export function Header() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-7xl">
        {/* Brand Lockup */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group" aria-label="HandicapLab home">
          <Logo className="w-10 h-10 text-foreground group-hover:text-foreground/90 transition-colors" />
          <div className="flex flex-col">
            <span className="font-display font-bold tracking-tight text-foreground text-lg leading-none">
              HANDICAPLAB
            </span>
            <span className="text-[10px] text-terracotta font-mono font-medium tracking-wide mt-0.5">
              Where Odds Meet Evidence.
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-muted-foreground" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'px-3 py-2 rounded-md transition-colors hover:text-foreground hover:bg-muted/50',
                isActive(item.href) && 'text-foreground bg-muted/60'
              )}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Sign In
          </Link>
          <Link 
            href="/pricing" 
            className="px-4 py-2 text-sm font-semibold bg-terracotta text-white rounded-md hover:bg-terracotta-muted transition-colors"
          >
            Pro / Account
          </Link>
        </div>
      </div>
    </header>
  );
}
