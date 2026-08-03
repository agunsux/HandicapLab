'use client';

import React from 'react';
import { Search, Bell, User } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function TopBar() {
  const pathname = usePathname();
  
  // Basic title generation from path
  const generateTitle = () => {
    if (pathname === '/app') return 'Overview';
    const parts = pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1).replace('-', ' ');
  };

  const title = generateTitle();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-medium text-foreground tracking-tight">{title}</h1>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md border border-border">
          <Search className="w-3.5 h-3.5" />
          <span>Cmd K</span>
        </div>
        
        <button className="text-muted-foreground hover:text-foreground transition-colors p-1 relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-terracotta rounded-full"></span>
        </button>
        
        <div className="h-8 w-8 rounded-full bg-secondary border border-border flex items-center justify-center text-secondary-foreground cursor-pointer hover:border-primary/50 transition-colors">
          <User className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
}
