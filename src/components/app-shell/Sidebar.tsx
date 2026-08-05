'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Zap,
  Scale,
  LineChart,
  Trophy,
  CircleDot,
  User,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Globe,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const MAIN_NAV = [
  { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { label: "Today's Signals", href: '/app/value-bets', icon: Zap },
  { label: 'Asian Handicap', href: '/app/markets/asian-handicap', icon: Scale },
  { label: 'Over / Under', href: '/app/markets/over-under', icon: LineChart },
  { label: 'Moneyline', href: '/app/markets/moneyline', icon: Trophy },
  { label: 'BTTS', href: '/app/markets/btts', icon: CircleDot },
];

const LEAGUES_NAV = [
  { label: 'Premier League', slug: 'premier-league', flag: '🇬🇧' },
  { label: 'La Liga', slug: 'la-liga', flag: '🇪🇸' },
  { label: 'Serie A', slug: 'serie-a', flag: '🇮🇹' },
  { label: 'Bundesliga', slug: 'bundesliga', flag: '🇩🇪' },
  { label: 'Ligue 1', slug: 'ligue-1', flag: '🇫🇷' },
];

const ACCOUNT_NAV = [
  { label: 'Profile', href: '/app/profile', icon: User },
  { label: 'Settings', href: '/app/settings', icon: Settings },
  { label: 'Pricing & Plans', href: '/pricing', icon: ShieldCheck },
];

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();

  const renderNavGroup = (
    title: string,
    items: { label: string; href?: string; slug?: string; icon?: React.ElementType; flag?: string }[]
  ) => (
    <div className="py-2">
      {!collapsed && (
        <h4 className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#5A6070]">
          {title}
        </h4>
      )}
      <div className="space-y-0.5">
        {items.map((item) => {
          const href = item.href || `/app/markets/asian-handicap?league=${item.slug}`;
          const isActive = pathname === href || (item.slug && pathname.includes('/markets') && pathname.includes(item.slug));
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group flex items-center gap-3 px-3 py-2 text-xs font-medium transition-all relative',
                isActive
                  ? 'bg-[#1A1D24] text-[#F0F1F5] font-semibold'
                  : 'text-[#8B92A8] hover:bg-[#1A1D24]/60 hover:text-[#F0F1F5]'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#6366F1] rounded-r-sm" />
              )}
              {Icon ? (
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-[#6366F1]' : 'text-[#8B92A8] group-hover:text-[#F0F1F5]')} />
              ) : (
                <span className="text-sm leading-none shrink-0">{item.flag || <Globe className="h-4 w-4 text-[#8B92A8]" />}</span>
              )}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="sm:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'bg-[#111318] border-r border-[#1F232C] flex flex-col z-50 transition-all duration-200 ease-in-out',
          // Desktop / Tablet layout
          'hidden sm:flex shrink-0 h-screen sticky top-0',
          collapsed ? 'w-[64px]' : 'w-[240px]',
          // Mobile Overlay Drawer layout
          mobileOpen && 'flex fixed inset-y-0 left-0 w-[240px] shadow-2xl z-[51]'
        )}
      >
        {/* Sidebar Header / Brand */}
        <div className="h-[64px] px-4 flex items-center justify-between border-b border-[#1F232C] shrink-0">
          <Link href="/app/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-7 w-7 rounded-lg bg-[#6366F1] flex items-center justify-center font-display font-bold text-white text-xs shrink-0 shadow-sm">
              HL
            </div>
            {!collapsed && (
              <span className="font-display font-bold text-sm tracking-tight text-[#F0F1F5] truncate">
                Handicap<span className="text-[#6366F1]">Lab</span>
              </span>
            )}
          </Link>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex h-6 w-6 items-center justify-center rounded-md text-[#8B92A8] hover:bg-[#1A1D24] hover:text-[#F0F1F5] transition-colors"
            aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>

          {/* Mobile drawer close toggle */}
          <button
            onClick={() => setMobileOpen(false)}
            className="sm:hidden flex h-7 w-7 items-center justify-center rounded-md text-[#8B92A8] hover:bg-[#1A1D24] hover:text-[#F0F1F5]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto py-3 divide-y divide-[#1F232C]/60 space-y-2">
          {renderNavGroup('Main Engine', MAIN_NAV)}
          {renderNavGroup('Leagues Whitelist', LEAGUES_NAV)}
          {renderNavGroup('Account & Tier', ACCOUNT_NAV)}
        </div>

        {/* Footer / Status */}
        {!collapsed && (
          <div className="p-3 border-t border-[#1F232C] bg-[#0A0B0F]/50 shrink-0">
            <div className="flex items-center justify-between text-[11px] text-[#5A6070]">
              <span>Quantitative v3.0</span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
