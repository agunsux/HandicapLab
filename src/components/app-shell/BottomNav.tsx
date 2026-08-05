'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, TrendingUp, Target, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const BOTTOM_ITEMS = [
  { label: 'Home', href: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Markets', href: '/app/markets/asian-handicap', icon: TrendingUp },
  { label: 'Signals', href: '/app/value-bets', icon: Target },
  { label: 'Stats', href: '/app/analysis', icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-[#0B0F0E]/95 backdrop-blur-md border-t border-[#1F2937] z-40 flex items-center justify-around px-2">
      {BOTTOM_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href.includes('/markets') && pathname.includes('/markets'));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center space-y-1 py-1 px-3 rounded-lg transition-colors',
              isActive ? 'text-[#10B981] font-semibold' : 'text-[#9CA3AF] hover:text-[#F0FDF4]'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
