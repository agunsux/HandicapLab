'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Bell, ChevronDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';

import { PRIMARY_NAV } from '@/config/navigation';

const DATE_FILTERS = ['Today', 'Tomorrow', 'Custom'] as const;

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [dateFilter, setDateFilter] = useState<(typeof DATE_FILTERS)[number]>('Today');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/app/value-bets?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 lg:px-6 shrink-0">
      {/* Left: brand + search */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <Link
          href="/app"
          className="flex md:hidden items-center gap-2 font-display font-bold tracking-tight text-foreground text-sm shrink-0"
          aria-label="HandicapLab home"
        >
          <Logo className="h-6 w-6" />
          <span className="hidden sm:inline">HandicapLab</span>
        </Link>

        <form onSubmit={handleSearch} className="relative hidden sm:block w-64 lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams, leagues, markets…"
            className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-terracotta/60 focus:ring-2 focus:ring-terracotta/20"
          />
        </form>
      </div>

      {/* Center/right: date filters + market quick filters + user */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Date filters */}
        <nav className="hidden lg:flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5" aria-label="Date filters">
          {DATE_FILTERS.map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={cn(
                'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                dateFilter === d
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {d === 'Custom' && <Calendar className="h-3 w-3" />}
              {d}
            </button>
          ))}
        </nav>

        {/* Primary Nav in TopBar */}
        <nav className="hidden md:flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5" aria-label="Primary Nav">
          {PRIMARY_NAV.map((m) => {
            const active = pathname === m.href || pathname.startsWith(m.href + '/');
            return (
              <Link
                key={m.href}
                href={m.href}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>

        {/* Notifications */}
        <button className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Notifications">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-status-warning" />
        </button>

        {/* Avatar + plan */}
        <Link
          href="/app/profile"
          className="flex items-center gap-2.5 rounded-md border border-border bg-card p-1 pr-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
            HL
          </div>
          <div className="hidden xl:block leading-tight">
            <div className="text-xs font-medium text-foreground">Pro Analyst</div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              Pro Plan
              <ChevronDown className="h-3 w-3" />
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
