'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background font-sans text-foreground">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        
        {/* Ticker Tape - preserved but styled more quietly */}
        <div className="h-6 bg-muted text-muted-foreground flex items-center px-4 overflow-hidden text-[10px] font-mono font-medium tracking-widest whitespace-nowrap border-b border-border shrink-0">
          <div className="animate-pulse flex gap-8">
             <span>CLV AVG: +2.4%</span>
             <span>BRIER: 0.21</span>
             <span>LATEST: ARS v CHE (VALUE)</span>
             <span className="text-signal-positive">SYS: OPERATIONAL</span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
          <div className="max-w-7xl mx-auto h-full">
             {children}
          </div>
        </main>
      </div>
    </div>
  );
}
