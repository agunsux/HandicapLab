'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, ShieldCheck, User, Bell } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';
import { PRIMARY_NAV } from '@/config/navigation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { userTier, setUserTier } = useAppStore();

  const tierColors = {
    free: 'bg-[#1F2937] text-[#9CA3AF] border-[#1F2937]',
    pro: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30',
    elite: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30',
  };

  const cycleTier = () => {
    if (userTier === 'free') setUserTier('pro');
    else if (userTier === 'pro') setUserTier('elite');
    else setUserTier('free');
  };

  return (
    <header className="h-[64px] fixed top-0 left-0 right-0 z-40 bg-[#0B0F0E]/90 backdrop-blur-md border-b border-[#1F2937] px-4 sm:px-6 flex items-center justify-between">
      {/* Brand & Left Actions */}
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F0FDF4] transition-colors"
            aria-label="Open mobile menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#10B981] flex items-center justify-center font-display font-bold text-black text-xs shadow-sm">
            HL
          </div>
          <span className="font-display font-bold text-base tracking-tight text-[#F0FDF4]">
            Handicap<span className="text-[#10B981]">Lab</span>
          </span>
        </Link>
      </div>

      {/* Nav Links (Desktop) */}
      <nav className="hidden md:flex items-center gap-6">
        {PRIMARY_NAV.map((nav) => {
          const isActive = pathname === nav.href;
          return (
            <Link
              key={nav.label}
              href={nav.href}
              className={cn(
                'text-xs font-medium transition-colors',
                isActive ? 'text-[#10B981] font-semibold' : 'text-[#9CA3AF] hover:text-[#F0FDF4]'
              )}
            >
              {nav.label}
            </Link>
          );
        })}
      </nav>

      {/* Right Controls: Search, Tier Badge (Clickable to test), Bell, Profile */}
      <div className="flex items-center gap-3">
        {/* Search Bar with ⌘K Spotlight */}
        <div className="hidden sm:block">
          <SearchBar />
        </div>

        {/* User Tier Badge (Clickable toggle for easy testing) */}
        <button
          onClick={cycleTier}
          title="Click to cycle plan tier (Free -> Pro -> Elite)"
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer',
            tierColors[userTier]
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{userTier} Tier</span>
        </button>

        {/* Bell Icon with Pulse Dot */}
        <div className="relative">
          <button className="h-8 w-8 rounded-full bg-[#111827] border border-[#1F2937] flex items-center justify-center text-[#9CA3AF] hover:text-[#F0FDF4] transition-colors">
            <Bell className="h-4 w-4" />
          </button>
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-[#10B981] animate-ping" />
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-[#10B981]" />
        </div>

        <Link
          href="/app/profile"
          className="h-8 w-8 rounded-full bg-[#111827] border border-[#1F2937] flex items-center justify-center text-[#9CA3AF] hover:text-[#F0FDF4] transition-colors"
        >
          <User className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
