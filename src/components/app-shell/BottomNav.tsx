'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Zap, LineChart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const BOTTOM_ITEMS = [
  { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Value Bets', href: '/app/value-bets', icon: Zap },
  { label: 'Markets', href: '/app/markets/asian-handicap', icon: LineChart },
  { label: 'Settings', href: '/app/settings', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-[#111318]/95 backdrop-blur-md border-t border-[#1F232C] z-40 flex items-center justify-around px-2">
      {BOTTOM_ITEMS.map((item) => {
        const isActive = pathname === item.href || (item.href.includes('/markets') && pathname.includes('/markets'));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center space-y-1 py-1 px-3 rounded-lg transition-colors',
              isActive
                ? 'text-[#6366F1]'
                : 'text-[#8B92A8] hover:text-[#F0F1F5]'
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
