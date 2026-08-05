'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, TrendingUp, Database, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const BOTTOM_ITEMS = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Markets', href: '/markets', icon: TrendingUp },
  { label: 'Historical', href: '/historical', icon: Database, isStar: true },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Account', href: '/settings', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-[#0B0F0E]/95 backdrop-blur-md border-t border-[#1F2937] z-40 flex items-center justify-around px-1">
      {BOTTOM_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center space-y-1 py-1 min-w-[56px] min-h-[44px] rounded-lg transition-colors relative',
              isActive ? 'text-[#10B981] font-semibold' : 'text-[#9CA3AF] hover:text-[#F0FDF4]'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-tight flex items-center gap-0.5">
              <span>{item.label}</span>
              {item.isStar && <span className="text-[#F59E0B] font-bold text-[8px]">★</span>}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
