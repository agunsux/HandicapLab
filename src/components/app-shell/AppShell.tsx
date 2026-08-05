'use client';

import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#0B0F0E] font-sans text-[#F0FDF4] flex flex-col selection:bg-[#10B981]/30 selection:text-[#F0FDF4]">
      {/* Top Header Bar */}
      <Header onMenuClick={() => setMobileOpen(!mobileOpen)} />

      {/* Main Layout Area below Header */}
      <div className="flex-1 pt-[64px] flex w-full relative">
        {/* Sidebar */}
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        {/* Content Viewport */}
        <main
          className={cn(
            'flex-1 min-w-0 bg-[#0B0F0E] pb-20 lg:pb-8 transition-all duration-300',
            collapsed ? 'lg:pl-16' : 'lg:pl-64'
          )}
        >
          <div className="mx-auto h-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
}