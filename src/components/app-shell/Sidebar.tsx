'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Target,
  BarChart3,
  CreditCard,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  Globe,
  X,
  Scale,
  LineChart,
  Trophy,
  CircleDot,
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
  { label: 'Markets', href: '/app/markets/asian-handicap', icon: TrendingUp },
  { label: 'Value Bets', href: '/app/value-bets', icon: Target },
  { label: 'Analytics', href: '/app/analysis', icon: BarChart3 },
  { label: 'Pricing', href: '/pricing', icon: CreditCard },
];

const MARKETS_SUBNAV = [
  { label: 'Asian Handicap', href: '/app/markets/asian-handicap', icon: Scale },
  { label: 'Over / Under', href: '/app/markets/over-under', icon: LineChart },
  { label: 'Moneyline', href: '/app/markets/moneyline', icon: Trophy },
  { label: 'BTTS', href: '/app/markets/btts', icon: CircleDot },
];

const ACCOUNT_NAV = [
  { label: 'Profile', href: '/app/profile', icon: User },
  { label: 'Settings', href: '/app/settings', icon: Settings },
];

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();

  const renderNavGroup = (
    title: string,
    items: { label: string; href: string; icon: React.ElementType }[]
  ) => (
    <div className="py-2">
      {!collapsed && (
        <h4 className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]/60">
          {title}
        </h4>
      )}
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-all relative mx-2',
                isActive
                  ? 'bg-[#10B981]/10 text-[#10B981] font-semibold border border-[#10B981]/30'
                  : 'text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F0FDF4]'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#10B981] rounded-r-sm" />
              )}
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  isActive ? 'text-[#10B981]' : 'text-[#9CA3AF] group-hover:text-[#F0FDF4]'
                )}
              />
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
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed top-[64px] bottom-0 left-0 z-40 bg-[#0B0F0E] border-r border-[#1F2937] flex flex-col transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Mobile Header / Close Button */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-[#1F2937]">
          <span className="font-bold text-xs uppercase tracking-wider text-[#9CA3AF]">Menu</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#F0FDF4] hover:bg-[#111827]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Nav Area */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          {renderNavGroup('Main Menu', MAIN_NAV)}
          {!collapsed && <div className="mx-4 border-t border-[#1F2937]/50 my-1" />}
          {renderNavGroup('Core Markets', MARKETS_SUBNAV)}
          {!collapsed && <div className="mx-4 border-t border-[#1F2937]/50 my-1" />}
          {renderNavGroup('Account', ACCOUNT_NAV)}
        </div>

        {/* Footer Collapse Toggle (Desktop) */}
        <div className="p-3 border-t border-[#1F2937] hidden lg:flex items-center justify-end">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="h-7 w-7 rounded-lg bg-[#111827] border border-[#1F2937] flex items-center justify-center text-[#9CA3AF] hover:text-[#F0FDF4] hover:bg-[#111827]/80 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
