'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Target,
  Radio,
  Database,
  Trophy,
  Users,
  Calendar,
  UserCheck,
  LineChart,
  GitCompare,
  TrendingDown,
  Award,
  Search,
  BarChart3,
  CheckCircle2,
  BookOpen,
  Cpu,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const OVERVIEW_NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Markets', href: '/markets', icon: TrendingUp },
  { label: 'Value Bets', href: '/value-bets', icon: Target },
  { label: 'Live Now', href: '/live', icon: Radio, badge: 'LIVE' },
];

const INTELLIGENCE_NAV = [
  { label: 'Historical Hub', href: '/historical', icon: Database, isStar: true },
  { label: 'Competitions', href: '/historical/competitions', icon: Trophy },
  { label: 'Teams', href: '/historical/teams', icon: Users },
  { label: 'Matches', href: '/historical/matches', icon: Calendar },
  { label: 'Players', href: '/historical/players', icon: UserCheck },
  { label: 'Odds Explorer', href: '/historical/odds-explorer', icon: LineChart },
  { label: 'Head-to-Head', href: '/historical/h2h', icon: GitCompare },
  { label: 'Trends', href: '/historical/trends', icon: TrendingDown },
  { label: 'Records', href: '/historical/records', icon: Award },
  { label: 'Search', href: '/historical/search', icon: Search },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Track Record', href: '/track-record', icon: CheckCircle2 },
];

const RESEARCH_NAV = [
  { label: 'Methodology', href: '/methodology', icon: BookOpen },
  { label: 'Models', href: '/models', icon: Cpu },
];

const ACCOUNT_NAV = [
  { label: 'Pricing', href: '/pricing', icon: CreditCard },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();

  const isLinkActive = (href: string) => {
    if (href === '/dashboard' || href === '/') {
      return pathname === '/dashboard' || pathname === '/app/dashboard' || pathname === '/';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  const renderNavGroup = (
    title: string,
    items: { label: string; href: string; icon: React.ElementType; badge?: string; isStar?: boolean }[]
  ) => (
    <div className="py-2">
      {!collapsed && (
        <h4 className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
          {title}
        </h4>
      )}
      <div className="space-y-1">
        {items.map((item) => {
          const active = isLinkActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-all relative mx-2',
                active
                  ? 'bg-[#10B981]/15 text-[#10B981] font-semibold border border-[#10B981]/40'
                  : 'text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F0FDF4]'
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#10B981] rounded-r-sm shadow-[0_0_8px_#10B981]" />
              )}

              <div className="relative shrink-0 flex items-center justify-center">
                <Icon
                  className={cn(
                    'h-4 w-4',
                    active ? 'text-[#10B981]' : 'text-[#9CA3AF] group-hover:text-[#F0FDF4]'
                  )}
                />
                {item.isStar && (
                  <Star className="h-2 w-2 text-[#F59E0B] fill-[#F59E0B] absolute -top-1 -right-1" />
                )}
              </div>

              {!collapsed && (
                <span className="truncate flex-1 flex items-center justify-between">
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-2 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 rounded-md animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </span>
              )}
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
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
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
          <span className="font-mono text-xs uppercase tracking-widest text-[#9CA3AF]">Navigation</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#F0FDF4] hover:bg-[#111827]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Nav Area */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1">
          {renderNavGroup('Overview', OVERVIEW_NAV)}
          {!collapsed && <div className="mx-4 border-t border-[#1F2937]/50 my-1" />}
          {renderNavGroup('Intelligence ⭐', INTELLIGENCE_NAV)}
          {!collapsed && <div className="mx-4 border-t border-[#1F2937]/50 my-1" />}
          {renderNavGroup('Research', RESEARCH_NAV)}
          {!collapsed && <div className="mx-4 border-t border-[#1F2937]/50 my-1" />}
          {renderNavGroup('Account', ACCOUNT_NAV)}
        </div>

        {/* Footer Collapse Toggle (Desktop) */}
        <div className="p-3 border-t border-[#1F2937] hidden lg:flex items-center justify-end">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="h-7 w-7 rounded-lg bg-[#111827] border border-[#1F2937] flex items-center justify-center text-[#9CA3AF] hover:text-[#F0FDF4] hover:bg-[#1A1F2E] transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
