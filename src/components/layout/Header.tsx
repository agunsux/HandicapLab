'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Bell, ChevronDown } from 'lucide-react';
import { PRIMARY_NAV, STATISTICS_SUB_NAV, ROUTES } from '@/config/navigation';
import { SearchBar } from '@/components/ui/SearchBar';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick?: () => void;
}

const STATISTICS_HREFS: string[] = STATISTICS_SUB_NAV.map((item) => item.href);

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();

  const isStatisticsActive = STATISTICS_HREFS.includes(pathname);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0B1120]/95 backdrop-blur-md border-b border-[#1E293B]">
      {/* Primary Top Bar */}
      <div className="h-[60px] px-4 sm:px-6 flex items-center justify-between max-w-7xl mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <BrandLogo size="sm" />
          </Link>

          {/* Data-first navigation (Desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            {PRIMARY_NAV.map((nav) => {
              const isStatistics = nav.href === ROUTES.statistics;
              const isActive = isStatistics
                ? isStatisticsActive
                : pathname === nav.href ||
                  (nav.href === '/#upcoming-matches' && pathname === '/');

              const linkClass = cn(
                'px-3.5 py-1.5 rounded-md text-xs font-medium transition-all inline-flex items-center gap-1',
                isActive
                  ? 'bg-[#1E293B] text-white font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F0F4F8] hover:bg-[#131B2E]'
              );

              if (isStatistics) {
                return (
                  <div key={nav.label} className="relative group">
                    <Link href={nav.href} className={linkClass} aria-haspopup="true">
                      {nav.label}
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Link>

                    {/* Statistics dropdown — real routes only */}
                    <div className="absolute left-0 top-full pt-2 hidden group-hover:block group-focus-within:block">
                      <div className="min-w-[180px] rounded-lg border border-[#1E293B] bg-[#0F1729] shadow-xl p-1.5">
                        {STATISTICS_SUB_NAV.map((sub) => {
                          const subActive = pathname === sub.href;
                          return (
                            <Link
                              key={sub.label}
                              href={sub.href}
                              className={cn(
                                'block px-3 py-2 rounded-md text-xs transition-colors',
                                subActive
                                  ? 'bg-[#1E293B] text-white font-semibold'
                                  : 'text-[#94A3B8] hover:text-white hover:bg-[#131B2E]'
                              )}
                            >
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <Link key={nav.label} href={nav.href} className={linkClass}>
                  {nav.label}
                </Link>
              );
            })}
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
            className="h-8 w-8 rounded-md border border-[#1E293B] bg-[#131B2E] flex items-center justify-center text-[#94A3B8] hover:text-[#F0F4F8] hover:border-[#334155] transition-colors relative"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
          </button>

          {/* Profile / Account Icon */}
          <Link
            href="/app/profile"
            aria-label="Account Profile"
            className={cn(
              'h-8 w-8 rounded-md border flex items-center justify-center transition-colors',
              pathname === '/app/profile' || pathname === '/profile'
                ? 'border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10'
                : 'border-[#1E293B] bg-[#131B2E] text-[#94A3B8] hover:text-[#F0F4F8] hover:border-[#334155]'
            )}
          >
            <User className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Mobile Sub-Header: Navigation */}
      <div className="md:hidden border-t border-[#1E293B]/80 px-3 py-2 bg-[#0B1120]">
        <div className="flex gap-1.5 overflow-x-auto">
          {PRIMARY_NAV.map((nav) => {
            const isStatistics = nav.href === ROUTES.statistics;
            const isActive = isStatistics
              ? isStatisticsActive || pathname === nav.href
              : pathname === nav.href ||
                (nav.href === '/#upcoming-matches' && pathname === '/');
            return (
              <Link
                key={nav.label}
                href={nav.href}
                className={cn(
                  'text-center py-1.5 px-3 rounded text-xs font-medium transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-[#1E293B] text-white font-semibold'
                    : 'bg-[#131B2E] text-[#94A3B8] border border-[#1E293B] hover:text-[#F0F4F8]'
                )}
              >
                {nav.shortLabel || nav.label}
              </Link>
            );
          })}

          {/* Statistics sub-navigation (mobile) */}
          {STATISTICS_SUB_NAV.map((sub) => (
            <Link
              key={sub.label}
              href={sub.href}
              className={cn(
                'text-center py-1.5 px-3 rounded text-xs font-medium transition-all whitespace-nowrap',
                pathname === sub.href
                  ? 'bg-[#1E293B] text-white font-semibold'
                  : 'bg-[#131B2E] text-[#94A3B8] border border-[#1E293B] hover:text-[#F0F4F8]'
              )}
            >
              {sub.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
