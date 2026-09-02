'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Bell } from 'lucide-react';
import { PRIMARY_NAV, ROUTES } from '@/config/navigation';
import { SearchBar } from '@/components/ui/SearchBar';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();

  const marketsNav = PRIMARY_NAV.filter((n) => n.href !== ROUTES.trackRecord);
  const trackRecordNav = PRIMARY_NAV.find((n) => n.href === ROUTES.trackRecord);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0A0E1A]/95 backdrop-blur-md border-b border-[#1F2937]">
      {/* Primary Top Bar */}
      <div className="h-[60px] px-4 sm:px-6 flex items-center justify-between max-w-7xl mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-7 w-7 rounded-md bg-[#10B981] flex items-center justify-center font-display font-black text-black text-xs shadow-sm group-hover:bg-[#10B981]/90 transition-colors">
              HL
            </div>
            <span className="font-display font-bold text-base tracking-tight text-[#F9FAFB]">
              Handicap<span className="text-[#10B981]">Lab</span>
            </span>
          </Link>

          {/* Three Markets (Desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            {marketsNav.map((nav) => {
              const isActive = pathname === nav.href;
              return (
                <Link
                  key={nav.label}
                  href={nav.href}
                  className={cn(
                    'px-3.5 py-1.5 rounded-md text-xs font-medium transition-all font-mono',
                    isActive
                      ? 'bg-[#10B981] text-black font-bold shadow-sm'
                      : 'text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-[#111827]'
                  )}
                >
                  {nav.label}
                </Link>
              );
            })}

            {trackRecordNav && (
              <Link
                href={trackRecordNav.href}
                className={cn(
                  'px-3.5 py-1.5 rounded-md text-xs font-mono transition-colors ml-1',
                  pathname === trackRecordNav.href
                    ? 'text-[#10B981] font-bold'
                    : 'text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-[#111827]'
                )}
              >
                {trackRecordNav.label}
              </Link>
            )}
          </nav>
        </div>

        {/* Right Controls: Search ⌘K, Bell 🔔, Profile 👤 */}
        <div className="flex items-center gap-3">
          {/* Search Bar with ⌘K Spotlight */}
          <div className="hidden lg:block">
            <SearchBar />
          </div>

          {/* Bell Notifications */}
          <button
            type="button"
            aria-label="Notifications"
            className="h-8 w-8 rounded-md border border-[#1F2937] bg-[#111827] flex items-center justify-center text-[#9CA3AF] hover:text-[#F9FAFB] hover:border-[#374151] transition-colors relative"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#10B981]" />
          </button>

          {/* Profile / Account Icon */}
          <Link
            href="/app/profile"
            aria-label="Account Profile"
            className={cn(
              'h-8 w-8 rounded-md border flex items-center justify-center transition-colors',
              pathname === '/app/profile' || pathname === '/profile'
                ? 'border-[#10B981] text-[#10B981] bg-[#10B981]/10'
                : 'border-[#1F2937] bg-[#111827] text-[#9CA3AF] hover:text-[#F9FAFB] hover:border-[#374151]'
            )}
          >
            <User className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Mobile Sub-Header: Immediate Three Markets Navigation */}
      <div className="md:hidden border-t border-[#1F2937]/80 px-3 py-2 bg-[#0A0E1A]">
        <div className="grid grid-cols-4 gap-1.5">
          {marketsNav.map((nav) => {
            const isActive = pathname === nav.href;
            return (
              <Link
                key={nav.label}
                href={nav.href}
                className={cn(
                  'text-center py-1.5 rounded text-xs font-mono transition-all',
                  isActive
                    ? 'bg-[#10B981] text-black font-bold'
                    : 'bg-[#111827] text-[#9CA3AF] border border-[#1F2937] hover:text-[#F9FAFB]'
                )}
              >
                {nav.shortLabel || nav.label}
              </Link>
            );
          })}
          {trackRecordNav && (
            <Link
              href={trackRecordNav.href}
              className={cn(
                'text-center py-1.5 rounded text-xs font-mono transition-all',
                pathname === trackRecordNav.href
                  ? 'bg-[#10B981] text-black font-bold'
                  : 'bg-[#111827] text-[#9CA3AF] border border-[#1F2937] hover:text-[#F9FAFB]'
              )}
            >
              Track
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
