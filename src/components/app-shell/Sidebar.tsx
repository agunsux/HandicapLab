'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Target, 
  Trophy, 
  Activity, 
  BarChart2, 
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CircleDot
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'CORE',
    items: [
      { name: 'Overview', href: '/app', icon: LayoutDashboard },
      { name: 'Opportunities', href: '/app/picks', icon: Target },
      { name: 'Matches', href: '/app/matches', icon: Trophy },
    ],
  },
  {
    label: 'MARKETS',
    items: [
      { name: 'Moneyline', href: '/app/markets/moneyline', icon: CircleDot },
      { name: 'Asian Handicap', href: '/app/markets/asian-handicap', icon: TrendingUp },
      { name: 'Over / Under', href: '/app/markets/over-under', icon: Activity },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { name: 'Performance', href: '/app/ledger', icon: BarChart2 },
      { name: 'Model', href: '/app/analysis', icon: Activity },
      { name: 'Research', href: '/research', icon: BookOpen },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { name: 'Profile', href: '/app/settings', icon: Settings },
    ],
  },
];

export function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean, setCollapsed: (val: boolean) => void }) {
  const pathname = usePathname();

  // Remember collapsed state
  useEffect(() => {
    const savedState = localStorage.getItem('handicaplab-sidebar-collapsed');
    if (savedState) {
      setCollapsed(savedState === 'true');
    }
  }, [setCollapsed]);

  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('handicaplab-sidebar-collapsed', String(newState));
  };

  return (
    <aside 
      className={cn(
        "flex flex-col h-screen border-r border-border bg-background transition-all duration-300 z-20 hidden md:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center justify-between px-4 border-b border-border shrink-0">
        {!collapsed && (
          <Link href="/app" className="font-mono font-bold tracking-tight text-foreground truncate">
            HANDICAPLAB
          </Link>
        )}
        {collapsed && (
          <Link href="/app" className="font-mono font-bold text-foreground mx-auto">
            HL
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 scrollbar-none">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label} className={cn("mb-6", collapsed ? "px-2" : "px-4")}>
            {!collapsed && (
              <h3 className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h3>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={collapsed ? item.name : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-muted text-foreground" 
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      collapsed && "justify-center"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "")} />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border mt-auto">
        <button
          onClick={toggleCollapse}
          className="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="ml-2 text-sm font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
