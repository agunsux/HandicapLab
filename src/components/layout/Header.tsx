'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, ChevronDown, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/live', label: "Today's Opportunities" },
  { href: '/markets', label: 'Markets' },
  { href: '/models', label: 'Models' },
  { href: '/performance', label: 'Performance' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: '/resources', label: 'Resources' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'id', label: 'Bahasa Indonesia' },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="HandicapLab home">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold tracking-tighter">
            HL
          </div>
          <span className="font-semibold text-lg tracking-tight hidden sm:inline-block">
            HandicapLab
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-muted-foreground" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'px-3 py-2 rounded-md transition-colors hover:text-foreground hover:bg-muted/50',
                isActive(item.href) && 'text-foreground bg-muted/60'
              )}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Language selector */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-haspopup="menu"
              aria-expanded={langOpen}
              aria-label="Select language"
            >
              <Globe className="size-4" />
              <ChevronDown className="size-3.5" />
            </button>
            {langOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-44 rounded-lg border border-border bg-popover elevation-2 py-1.5"
              >
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    role="menuitem"
                    onClick={() => setLangOpen(false)}
                    className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/login"
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Button asChild className="rounded-full px-5 font-semibold">
              <Link href="/pricing">Start Free Trial</Link>
            </Button>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav
          className="lg:hidden border-t border-border bg-background px-4 py-4"
          aria-label="Mobile"
        >
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors',
                  isActive(item.href) && 'text-foreground bg-muted/60'
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="h-px bg-border my-2" />
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Sign In
            </Link>
            <Button asChild className="mt-2 rounded-full font-semibold">
              <Link href="/pricing" onClick={() => setMobileOpen(false)}>
                Start Free Trial
              </Link>
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
