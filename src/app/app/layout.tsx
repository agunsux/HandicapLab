'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/app-shell/Sidebar';
import { TopBar } from '@/components/app-shell/TopBar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-background relative focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}