'use client';

import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#0A0B0F] font-sans text-[#F0F1F5] flex flex-col">
      {/* Top Header Bar */}
      <Header onMenuClick={() => setMobileOpen(!mobileOpen)} />

      {/* Main Layout Area below Header */}
      <div className="flex-1 pt-[64px] flex w-full">
        {/* Sidebar */}
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        {/* Content Viewport */}
        <main className="flex-1 min-w-0 bg-[#0A0B0F] pb-16 sm:pb-8">
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