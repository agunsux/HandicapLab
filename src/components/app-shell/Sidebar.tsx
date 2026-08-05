'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Target,
  CircleDot,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { ROUTES, APP_SIDEBAR_NAV } from '@/config/navigation';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const getIconForRoute = (href: string) => {
  if (href === ROUTES.dashboard) return LayoutDashboard;
  if (href === ROUTES.valueBets) return Target;
  return CircleDot;
};

const NAV_ITEMS: NavItem[] = APP_SIDEBAR_NAV.map((item) => ({
  name: item.label,
  href: item.href,
  icon: getIconForRoute(item.href),
}));

const FOOTER_ITEMS: NavItem[] = [
  { name: 'Profile', href: ROUTES.profile, icon: User },
  { name: 'Settings', href: ROUTES.settings, icon: Settings },
];

export function Sidebar({ setCollapsed }: { collapsed: boolean; setCollapsed: (val: boolean) => void }) {
  const pathname = usePathname();
  // Default to expanded (false) until client mounts
  const [isCollapsed, setIsCollapsedState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('handicaplab-sidebar-collapsed');
    if (saved === 'true') {
      setIsCollapsedState(true);
      setCollapsed(true);
    }
  }, [setCollapsed]);

  const toggleSidebar = () => {
    const next = !isCollapsed;
    setIsCollapsedState(next);
    setCollapsed(next);
    localStorage.setItem('handicaplab-sidebar-collapsed', String(next));
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/app/dashboard' && pathname.startsWith(href));

  // Determine expansion purely by state, not hover
  const expanded = mounted ? !isCollapsed : true;

  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          title={!expanded ? item.name : undefined}
          aria-label={item.name}
          className={cn(
            'flex items-center rounded-md py-2 font-medium transition-colors border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/20',
            !expanded ? 'justify-center px-0 border-l-0' : 'gap-3 px-3',
            active
              ? 'border-terracotta text-terracotta bg-terracotta/10'
              : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
        >
          <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
            <item.icon className="h-full w-full" />
          </div>
          {expanded && <span className="truncate text-sm">{item.name}</span>}
        </Link>
      );
    });

  return (
    <aside
      className={cn(
        'flex flex-col h-screen border-r border-border bg-card transition-[width] duration-200 ease-in-out z-30 hidden md:flex',
        expanded ? 'w-[240px]' : 'w-16'
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center px-4 border-b border-border shrink-0">
        <Link 
          href="/app" 
          className={cn("flex items-center gap-2 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/20 rounded", !expanded && "justify-center w-full")}
          aria-label="Home"
        >
          <Logo className="h-6 w-6 shrink-0" />
          {expanded && (
            <span className="font-display font-bold tracking-tight text-foreground text-sm truncate">HandicapLab</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-none">
        <div className={cn('space-y-1', expanded ? 'px-3' : 'px-2')}>
          {renderItems(NAV_ITEMS)}
        </div>
        <div className={cn('my-4 border-t border-border', expanded ? 'mx-4' : 'mx-2')} />
        <div className={cn('space-y-1', expanded ? 'px-3' : 'px-2')}>
          {renderItems(FOOTER_ITEMS)}
        </div>
      </div>

      {/* Collapse control */}
      <div className="p-3 border-t border-border mt-auto">
        <button
          onClick={toggleSidebar}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          className="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/20"
        >
          {expanded ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
      </div>
    </aside>
  );
}
