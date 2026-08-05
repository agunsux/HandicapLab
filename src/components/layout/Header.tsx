'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search, ShieldCheck, User } from 'lucide-react';
import { PRIMARY_NAV } from '@/config/navigation';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="h-[64px] fixed top-0 left-0 right-0 z-40 bg-[#0A0B0F]/80 backdrop-blur-md border-b border-[#1F232C] px-4 sm:px-6 flex items-center justify-between">
      {/* Brand & Left Actions */}
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="sm:hidden flex h-8 w-8 items-center justify-center rounded-lg text-[#8B92A8] hover:bg-[#1A1D24] hover:text-[#F0F1F5] transition-colors"
            aria-label="Open mobile menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#6366F1] flex items-center justify-center font-display font-bold text-white text-xs shadow-sm">
            HL
          </div>
          <span className="font-display font-bold text-base tracking-tight text-[#F0F1F5]">
            Handicap<span className="text-[#6366F1]">Lab</span>
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
                isActive ? 'text-[#6366F1] font-semibold' : 'text-[#8B92A8] hover:text-[#F0F1F5]'
              )}
            >
              {nav.label}
            </Link>
          );
        })}
      </nav>

      {/* Right Controls: Search, Tier, Profile */}
      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5A6070]" />
          <input
            type="text"
            placeholder="Search teams, leagues..."
            className="h-8 w-44 lg:w-56 rounded-lg bg-[#111318] border border-[#1F232C] pl-8 pr-3 text-xs text-[#F0F1F5] placeholder-[#5A6070] focus:border-[#6366F1] focus:outline-none transition-colors"
          />
        </div>

        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/30 text-[#818CF8] text-xs font-medium hover:bg-[#6366F1]/20 transition-colors"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Quant Tier</span>
        </Link>

        <Link
          href="/app/profile"
          className="h-8 w-8 rounded-full bg-[#1A1D24] border border-[#1F232C] flex items-center justify-center text-[#8B92A8] hover:text-[#F0F1F5] transition-colors"
        >
          <User className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
