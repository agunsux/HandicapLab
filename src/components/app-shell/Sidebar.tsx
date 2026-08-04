'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Target,
  Scale,
  LineChart,
  Trophy,
  CircleDot,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { name: 'Value Bets', href: '/app/value-bets', icon: Target },
  { name: 'Asian Handicap', href: '/app/markets/asian-handicap', icon: Scale },
  { name: 'Over / Under', href: '/app/markets/over-under', icon: LineChart },
  { name: 'Moneyline', href: '/app/markets/moneyline', icon: Trophy },
  { name: 'BTTS', href: '/app/markets/btts', icon: CircleDot },
];

const FOOTER_ITEMS: NavItem[] = [
  { name: 'Profile', href: '/app/profile', icon: User },
  { name: 'Settings', href: '/app/settings', icon: Settings },
];

export function Sidebar({ setCollapsed }: { collapsed: boolean; setCollapsed: (val: boolean) => void }) {
  const pathname = usePathname();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('handicaplab-sidebar-collapsed');
    if (saved !== null) {
      setPinned(saved !== 'true');
    }
  }, []);

  const expanded = pinned || hovered;

  useEffect(() => {
    setCollapsed(!expanded);
  }, [expanded, setCollapsed]);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem('handicaplab-sidebar-collapsed', String(!next));
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/app/dashboard' && pathname.startsWith(href));

  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          title={!expanded ? item.name : undefined}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors border-l-2',
            !expanded ? 'justify-center px-0 border-l-0' : '',
            active
              ? 'border-terracotta text-foreground bg-muted/20'
              : 'border-transparent text-muted-foreground hover:bg-muted/10 hover:text-foreground'
          )}
        >
          <item.icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-terracotta')} />
          {expanded && <span className="truncate">{item.name}</span>}
        </Link>
      );
    });

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'flex flex-col h-screen border-r border-border bg-card transition-[width] duration-200 ease-out z-30 hidden md:flex',
        expanded ? 'w-56' : 'w-16'
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-border shrink-0">
        <Link href="/app" className="flex items-center gap-2 overflow-hidden w-full">
          {expanded ? (
            <>
              <Logo className="h-6 w-6" />
              <span className="font-display font-bold tracking-tight text-foreground text-sm truncate">HandicapLab</span>
            </>
          ) : (
            <Logo className="h-6 w-6 mx-auto" />
          )}
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-none">
        <div className={cn('space-y-0.5', expanded ? 'px-3' : 'px-2')}>
          {renderItems(NAV_ITEMS)}
        </div>
        <div className={cn('my-4 border-t border-border', expanded ? 'mx-4' : 'mx-2')} />
        <div className={cn('space-y-0.5', expanded ? 'px-3' : 'px-2')}>
          {renderItems(FOOTER_ITEMS)}
        </div>
      </div>

      {/* Pin toggle */}
      <div className="p-3 border-t border-border mt-auto">
        <button
          onClick={togglePin}
          className="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
        >
          {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
